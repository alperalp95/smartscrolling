// Verifies supabase/migrations/20261124080249_card_ask_foundation.sql on PGlite:
// ai_usage + consume_ai_quota, facts.context_text, ai_content_reports.fact_id.
// All earlier migrations run in order first. Run: node --test supabase/tests/*.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { vector } from '@electric-sql/pglite/vector';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');
const FOUNDATION = '20261124080249_card_ask_foundation.sql';
const read = (name) => readFileSync(join(migrationsDir, name), 'utf8');
const PRIOR_MIGRATIONS = [
  '20260409000000_schema_and_rls.sql',
  '20260419140942_p2_03g_fact_visual_key.sql',
  '20260505082724_p6_09b_ai_content_reports.sql',
  '20261123085248_content_pipeline_v2.sql',
  '20261123085302_content_pipeline_v2_followups.sql',
];

const SUPABASE_STUBS = `
  set timezone = 'UTC';
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  create schema if not exists extensions;
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, extensions, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const U1 = '00000000-0000-0000-0000-0000000000a1';
const U2 = '00000000-0000-0000-0000-0000000000a2';
const F1 = '10000000-0000-0000-0000-0000000000f1';

let db;

async function asRole(role, sql, params = []) {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

async function rejects(promise, pattern) {
  await assert.rejects(promise, (error) => {
    assert.match(String(error?.message ?? error), pattern);
    return true;
  });
}

const consume = (user, limit) =>
  asRole('service_role', 'select * from public.consume_ai_quota($1::uuid, $2::int)', [
    user,
    limit,
  ]).then((r) => r.rows[0]);

describe('card ask foundation migration', () => {
  before(async () => {
    db = new PGlite({ extensions: { vector, uuid_ossp } });
    await db.exec(SUPABASE_STUBS);
    // Only the migrations this one depends on (others need extensions PGlite lacks, e.g. pgcrypto).
    for (const name of PRIOR_MIGRATIONS) await db.exec(read(name));
    await db.exec(read(FOUNDATION)); // second run: idempotent

    await db.query(
      `insert into auth.users (id, email) values ($1, 'a1@test.dev'), ($2, 'a2@test.dev')
       on conflict do nothing`,
      [U1, U2],
    );
    await db.query(
      `insert into public.users (id, email) values ($1, 'a1@test.dev'), ($2, 'a2@test.dev')
       on conflict do nothing`,
      [U1, U2],
    );
    await db.query(
      `insert into public.facts (id, title, content, category) values ($1, 'T', 'C', 'Bilim')`,
      [F1],
    );
  });

  after(async () => {
    await db?.close();
  });

  it('consume_ai_quota: limit 3 allows 3 calls then denies', async () => {
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await consume(U1, 3));
    assert.deepEqual(results[0], { allowed: true, used: 1, remaining: 2 });
    assert.deepEqual(results[1], { allowed: true, used: 2, remaining: 1 });
    assert.deepEqual(results[2], { allowed: true, used: 3, remaining: 0 });
    assert.deepEqual(results[3], { allowed: false, used: 3, remaining: 0 });
    const { rows } = await db.query('select count from public.ai_usage where user_id = $1', [U1]);
    assert.equal(rows[0].count, 3, 'denied call does not increment');
  });

  it('counts users separately', async () => {
    const r = await consume(U2, 3);
    assert.deepEqual(r, { allowed: true, used: 1, remaining: 2 });
  });

  it('counts days separately', async () => {
    await db.query('update public.ai_usage set day = day - 1 where user_id = $1', [U1]);
    const r = await consume(U1, 3);
    assert.deepEqual(r, { allowed: true, used: 1, remaining: 2 });
    const { rows } = await db.query(
      'select count(*)::int as n from public.ai_usage where user_id = $1',
      [U1],
    );
    assert.equal(rows[0].n, 2);
  });

  it('anon/authenticated cannot run consume_ai_quota or read ai_usage', async () => {
    for (const role of ['anon', 'authenticated']) {
      await rejects(
        asRole(role, 'select * from public.consume_ai_quota($1::uuid, 3)', [U1]),
        /permission denied/,
      );
      await rejects(asRole(role, 'select * from public.ai_usage'), /permission denied/);
    }
    const rls = await db.query(
      `select relrowsecurity from pg_class where oid = 'public.ai_usage'::regclass`,
    );
    assert.equal(rls.rows[0].relrowsecurity, true);
    const pol = await db.query(
      `select count(*)::int as n from pg_policies where tablename = 'ai_usage'`,
    );
    assert.equal(pol.rows[0].n, 0);
  });

  it('facts.context_text: null and 2000 ok, 2401 rejected', async () => {
    const set = (v) =>
      db.query('update public.facts set context_text = $2 where id = $1', [F1, v]);
    await set(null);
    await set('x'.repeat(2000));
    await rejects(set('x'.repeat(2401)), /facts_context_text_len_check|check constraint/);
  });

  it('ai_content_reports accepts fact_id (insert policy unchanged)', async () => {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [U1]);
    await asRole(
      'authenticated',
      `insert into public.ai_content_reports (user_id, fact_id, assistant_message, reason)
       values ($1, $2, 'msg', 'wrong_information')`,
      [U1, F1],
    );
    const { rows } = await db.query(
      'select fact_id, book_id from public.ai_content_reports where user_id = $1',
      [U1],
    );
    assert.equal(rows[0].fact_id, F1);
    assert.equal(rows[0].book_id, null);
  });
});
