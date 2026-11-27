// Verifies supabase/migrations/20261127204810_series.sql on PGlite:
// series / series_cards / series_progress tables, RLS premium preview, replace_series_cards.
// Run: node --test supabase/tests/series.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(here, '..', 'migrations', '20261127204810_series.sql');

const SUPABASE_STUBS = `
  set timezone = 'UTC';
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  create schema if not exists extensions;
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text
  );
  create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.jwt() returns jsonb
  language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema public, extensions, auth to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const U1 = '00000000-0000-0000-0000-0000000000a1';
const U2 = '00000000-0000-0000-0000-0000000000a2';
const S_FREE = '20000000-0000-0000-0000-000000000001';
const S_PREM = '20000000-0000-0000-0000-000000000002';
const S_DRAFT = '20000000-0000-0000-0000-000000000003';

let db;

/** Runs sql as a role; optional JWT claims (app_metadata etc.) and sub. */
async function as(role, sql, params = [], { sub = '', claims = {} } = {}) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify(sub ? { sub, ...claims } : claims),
  ]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
    await db.exec(
      `select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)`,
    );
  }
}

async function rejects(promise, pattern) {
  await assert.rejects(promise, (error) => {
    assert.match(String(error?.message ?? error), pattern);
    return true;
  });
}

const cardsOf = (seriesId, role, opts) =>
  as(
    role,
    'select position from public.series_cards where series_id = $1 order by position',
    [seriesId],
    opts,
  ).then((r) => r.rows.map((row) => row.position));

const cardsJson = (n) =>
  JSON.stringify(
    Array.from({ length: n }, (_, i) => ({
      position: i + 1,
      section_title: `Bölüm ${i + 1}`,
      body: `Gövde ${i + 1}`,
    })),
  );

describe('series migration', () => {
  before(async () => {
    db = new PGlite();
    await db.exec(SUPABASE_STUBS);
    const sql = readFileSync(MIGRATION, 'utf8');
    await db.exec(sql);
    await db.exec(sql); // second run: idempotent

    await db.query(`insert into auth.users (id, email) values ($1, 'a1@t.dev'), ($2, 'a2@t.dev')`, [
      U1,
      U2,
    ]);
    for (const [id, slug, free, status] of [
      [S_FREE, 'free', true, 'published'],
      [S_PREM, 'prem', false, 'published'],
      [S_DRAFT, 'draft', true, 'draft'],
    ]) {
      await db.query(
        `insert into public.series (id, slug, title, summary, category, source_title, source_url, is_free, status, published_at)
         values ($1, $2, $2, 's', '📜 TARİH', $2, 'https://tr.wikipedia.org/wiki/x', $3, $4, now())`,
        [id, slug, free, status],
      );
      for (let p = 1; p <= 5; p += 1) {
        await db.query(
          `insert into public.series_cards (series_id, position, section_title, body) values ($1, $2, 'b', 'x')`,
          [id, p],
        );
      }
    }
  });

  after(async () => {
    await db?.close();
  });

  it('series_preview_cards() is 3', async () => {
    const { rows } = await db.query('select public.series_preview_cards() as n');
    assert.equal(rows[0].n, 3);
  });

  it('anon does not see draft series, sees published', async () => {
    const { rows } = await as('anon', 'select slug from public.series order by slug');
    assert.deepEqual(
      rows.map((r) => r.slug),
      ['free', 'prem'],
    );
  });

  it('anon cannot read cards of a draft series', async () => {
    assert.deepEqual(await cardsOf(S_DRAFT, 'anon'), []);
  });

  it('anon reads all free-series cards and only 1-3 of premium series', async () => {
    assert.deepEqual(await cardsOf(S_FREE, 'anon'), [1, 2, 3, 4, 5]);
    assert.deepEqual(await cardsOf(S_PREM, 'anon'), [1, 2, 3]);
    const { rows } = await as(
      'anon',
      'select count(*)::int as n from public.series_cards where series_id = $1 and position = 4',
      [S_PREM],
    );
    assert.equal(rows[0].n, 0);
  });

  it('authenticated with app_metadata.premium=true reads all cards', async () => {
    const opts = { sub: U1, claims: { app_metadata: { premium: true } } };
    assert.deepEqual(await cardsOf(S_PREM, 'authenticated', opts), [1, 2, 3, 4, 5]);
  });

  it('authenticated with premium=false or missing reads only 1-3', async () => {
    const off = { sub: U1, claims: { app_metadata: { premium: false } } };
    const none = { sub: U1, claims: {} };
    assert.deepEqual(await cardsOf(S_PREM, 'authenticated', off), [1, 2, 3]);
    assert.deepEqual(await cardsOf(S_PREM, 'authenticated', none), [1, 2, 3]);
  });

  it('user_metadata.premium does not unlock cards', async () => {
    const opts = { sub: U1, claims: { user_metadata: { premium: true } } };
    assert.deepEqual(await cardsOf(S_PREM, 'authenticated', opts), [1, 2, 3]);
  });

  it('clients cannot write series or series_cards', async () => {
    await rejects(
      as('authenticated', `update public.series set title = 'hack'`, [], { sub: U1 }),
      /permission denied/i,
    );
    await rejects(as('anon', 'delete from public.series_cards'), /permission denied/i);
  });

  it('user reads/writes only own series_progress', async () => {
    await as(
      'authenticated',
      'insert into public.series_progress (user_id, series_id, last_position) values ($1, $2, 4)',
      [U1, S_FREE],
      { sub: U1 },
    );
    await as(
      'authenticated',
      'insert into public.series_progress (user_id, series_id, last_position) values ($1, $2, 2)',
      [U2, S_FREE],
      { sub: U2 },
    );
    const own = await as('authenticated', 'select user_id from public.series_progress', [], {
      sub: U1,
    });
    assert.deepEqual(
      own.rows.map((r) => r.user_id),
      [U1],
    );
    await rejects(
      as(
        'authenticated',
        'insert into public.series_progress (user_id, series_id, last_position) values ($1, $2, 1)',
        [U2, S_PREM],
        { sub: U1 },
      ),
      /row-level security/i,
    );
    const upd = await as(
      'authenticated',
      'update public.series_progress set last_position = 1 where user_id = $1',
      [U2],
      { sub: U1 },
    );
    assert.equal(upd.affectedRows, 0);
    await rejects(as('anon', 'select * from public.series_progress'), /permission denied/i);
  });

  it('replace_series_cards: denied for anon and authenticated', async () => {
    await rejects(
      as('anon', `select public.replace_series_cards($1::uuid, '[]'::jsonb)`, [S_FREE]),
      /permission denied/i,
    );
    await rejects(
      as('authenticated', `select public.replace_series_cards($1::uuid, '[]'::jsonb)`, [S_FREE], {
        sub: U1,
      }),
      /permission denied/i,
    );
  });

  it('replace_series_cards (service_role): replaces cards, updates count, clamps progress', async () => {
    // U1 progress on S_FREE is 4; shrink 5 -> 2 cards
    await as('service_role', 'select public.replace_series_cards($1::uuid, $2::jsonb)', [
      S_FREE,
      cardsJson(2),
    ]);
    assert.deepEqual(await cardsOf(S_FREE, 'service_role'), [1, 2]);
    const s = await db.query('select card_count from public.series where id = $1', [S_FREE]);
    assert.equal(s.rows[0].card_count, 2);
    const p = await db.query(
      'select user_id, last_position from public.series_progress where series_id = $1 order by user_id',
      [S_FREE],
    );
    assert.deepEqual(
      p.rows.map((r) => [r.user_id, r.last_position]),
      [
        [U1, 2], // clamped from 4
        [U2, 2], // unchanged
      ],
    );
    // grow back: progress is not raised
    await as('service_role', 'select public.replace_series_cards($1::uuid, $2::jsonb)', [
      S_FREE,
      cardsJson(6),
    ]);
    const c = await db.query('select card_count from public.series where id = $1', [S_FREE]);
    assert.equal(c.rows[0].card_count, 6);
    const p2 = await db.query(
      'select last_position from public.series_progress where series_id = $1 and user_id = $2',
      [S_FREE, U1],
    );
    assert.equal(p2.rows[0].last_position, 2);
  });

  it('replace_series_cards rejects unknown series and non-array input', async () => {
    await rejects(
      as('service_role', `select public.replace_series_cards($1::uuid, '[]'::jsonb)`, [
        '29999999-0000-0000-0000-000000000000',
      ]),
      /series not found/i,
    );
    await rejects(
      as('service_role', `select public.replace_series_cards($1::uuid, '{}'::jsonb)`, [S_FREE]),
      /p_cards must be a json array/i,
    );
  });
});
