// Verifies supabase/migrations/20261124120000_drop_book_feature.sql on PGlite.
// Run: node --test supabase/tests/*.test.mjs

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
const MIGRATION = '20261124120000_drop_book_feature.sql';
const read = (name) => readFileSync(join(migrationsDir, name), 'utf8');
const PRIOR_MIGRATIONS = [
  '20260409000000_schema_and_rls.sql',
  '20260419140942_p2_03g_fact_visual_key.sql',
  '20260505082724_p6_09b_ai_content_reports.sql',
  '20261123085248_content_pipeline_v2.sql',
  '20261123085302_content_pipeline_v2_followups.sql',
  '20261124080249_card_ask_foundation.sql',
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
const F1 = '10000000-0000-0000-0000-0000000000f1';

let db;

const tableExists = async (name) =>
  (
    await db.query(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = $1`,
      [name],
    )
  ).rows.length > 0;

const columnExists = async (table, column) =>
  (
    await db.query(
      `select 1 from information_schema.columns
       where table_schema = 'public' and table_name = $1 and column_name = $2`,
      [table, column],
    )
  ).rows.length > 0;

describe('drop book feature migration', () => {
  before(async () => {
    db = new PGlite({ extensions: { vector, uuid_ossp } });
    await db.exec(SUPABASE_STUBS);
    // The p3_06 migration (book_sections) needs pgcrypto, which PGlite lacks, so stub the table.
    for (const name of PRIOR_MIGRATIONS) await db.exec(read(name));
    await db.exec(`
      create table public.book_sections (
        id uuid primary key default gen_random_uuid(),
        book_id uuid not null references public.books(id) on delete cascade,
        section_order int not null
      );
    `);

    await db.query(`insert into auth.users (id, email) values ($1, 'a1@test.dev')`, [U1]);
    await db.query(`insert into public.users (id, email) values ($1, 'a1@test.dev')`, [U1]);
    await db.query(
      `insert into public.facts (id, title, content, category) values ($1, 'T', 'C', 'Bilim')`,
      [F1],
    );
    // Legacy rows: one old book report (no fact_id) and one card report.
    await db.query(
      `insert into public.ai_content_reports (assistant_message, reason, book_title)
       values ('old', 'other', 'Eski Kitap')`,
    );
    await db.query(
      `insert into public.ai_content_reports (assistant_message, reason, fact_id)
       values ('card', 'other', $1)`,
      [F1],
    );
    await db.query('insert into public.bookmarks (user_id, fact_id) values ($1, $2)', [U1, F1]);

    await db.exec(read(MIGRATION));
    await db.exec(read(MIGRATION)); // second run: idempotent
  });

  after(async () => {
    await db?.close();
  });

  it('book tables are gone', async () => {
    for (const t of [
      'books',
      'book_sections',
      'book_highlights',
      'reading_progress',
      'chat_sessions',
    ]) {
      assert.equal(await tableExists(t), false, t);
    }
  });

  it('book columns are gone, fact_id stays', async () => {
    assert.equal(await columnExists('bookmarks', 'book_id'), false);
    assert.equal(await columnExists('ai_content_reports', 'book_id'), false);
    assert.equal(await columnExists('ai_content_reports', 'book_title'), false);
    assert.equal(await columnExists('bookmarks', 'fact_id'), true);
    assert.equal(await columnExists('ai_content_reports', 'fact_id'), true);
    assert.equal(await columnExists('user_activity', 'pages_read'), true);
  });

  it('legacy book report removed, card report and bookmark kept', async () => {
    const reports = await db.query('select assistant_message from public.ai_content_reports');
    assert.deepEqual(
      reports.rows.map((r) => r.assistant_message),
      ['card'],
    );
    const marks = await db.query('select fact_id from public.bookmarks');
    assert.equal(marks.rows.length, 1);
  });

  it('ai_content_reports insert with fact_id works as authenticated', async () => {
    await db.exec('set role authenticated');
    try {
      await db.exec(`select set_config('request.jwt.claim.sub', '${U1}', false)`);
      await db.query(
        `insert into public.ai_content_reports (assistant_message, reason, fact_id, user_id)
         values ('new', 'wrong_information', $1, $2)`,
        [F1, U1],
      );
    } finally {
      await db.exec('reset role');
    }
    const r = await db.query('select count(*)::int as n from public.ai_content_reports');
    assert.equal(r.rows[0].n, 2);
  });
});
