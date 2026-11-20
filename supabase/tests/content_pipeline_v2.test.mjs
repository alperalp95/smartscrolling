// Verifies supabase/migrations/20261120120000_content_pipeline_v2.sql on PGlite.
// Supabase platform pieces (roles, auth schema, extensions schema, default grants)
// are stubbed minimally; the real earlier migrations that define public.facts run
// first, then the new migration is applied twice.
//
// Run: node --test "supabase/tests/**/*.test.mjs"

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
const readMigration = (name) => readFileSync(join(migrationsDir, name), 'utf8');

const PRIOR_MIGRATIONS = [
  '20260409000000_schema_and_rls.sql', // users, facts (+ "Anyone can read facts"), ...
  '20260419140942_p2_03g_fact_visual_key.sql', // facts.visual_key
];
const V2_MIGRATION = '20261120120000_content_pipeline_v2.sql';

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

  -- Mirror Supabase: new objects in public are granted to the API roles by default,
  -- so the migration itself must revoke what it does not want exposed.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const DIM = 1024;

/** Unit-ish vector pointing mostly along axis `axis`, nudged towards `mixAxis`. */
function vec(axis, mixAxis = null, mix = 0) {
  const values = new Array(DIM).fill(0);
  values[axis] = 1;
  if (mixAxis !== null) values[mixAxis] = mix;
  return `[${values.join(',')}]`;
}

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

describe('content pipeline v2 migration', () => {
  before(async () => {
    db = new PGlite({ extensions: { vector, uuid_ossp } });
    await db.exec(SUPABASE_STUBS);
    for (const name of PRIOR_MIGRATIONS) {
      await db.exec(readMigration(name));
    }

    // A legacy card that exists before v2 (published_at was a DATE column).
    await db.query(
      `insert into public.facts (id, title, content, category, published_at, created_at)
       values ($1, 'Eski kart', 'Eski icerik', 'Bilim', '2026-01-02', '2026-01-01T10:00:00Z')`,
      ['00000000-0000-0000-0000-000000000001'],
    );

    await db.exec(readMigration(V2_MIGRATION));
  });

  after(async () => {
    await db?.close();
  });

  it('backfills legacy facts: status=published, published_at=created_at (timestamptz)', async () => {
    const column = await db.query(
      `select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'facts' and column_name = 'published_at'`,
    );
    assert.equal(column.rows[0].data_type, 'timestamp with time zone');

    const { rows } = await db.query(
      `select status, published_at = created_at as same, published_at
       from public.facts where id = $1`,
      ['00000000-0000-0000-0000-000000000001'],
    );
    assert.equal(rows[0].status, 'published');
    assert.equal(rows[0].same, true);
  });

  it('is idempotent: second run succeeds and keeps data', async () => {
    await db.query(
      `insert into public.facts (id, title, content, category, status)
       values ($1, 'Kuyruktaki kart', 'Bekleyen icerik', 'Tarih', 'queued')`,
      ['00000000-0000-0000-0000-000000000002'],
    );

    await db.exec(readMigration(V2_MIGRATION));

    const { rows } = await db.query(
      'select id, status, published_at from public.facts order by id',
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].status, 'published');
    assert.equal(rows[1].status, 'queued');
    assert.equal(rows[1].published_at, null);

    const policies = await db.query(
      `select policyname, qual from pg_policies where schemaname = 'public' and tablename = 'facts'`,
    );
    assert.equal(policies.rows.length, 1);
    assert.equal(policies.rows[0].policyname, 'Anyone can read facts');
    assert.match(policies.rows[0].qual, /status = 'published'/);
  });

  it('creates the expected indexes', async () => {
    const { rows } = await db.query(
      `select indexname, indexdef from pg_indexes
       where schemaname = 'public' and tablename in ('facts', 'fact_candidates')`,
    );
    const byName = Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]));
    assert.match(byName.fact_candidates_embedding_hnsw_idx, /USING hnsw .*vector_cosine_ops/);
    assert.match(byName.fact_candidates_status_created_at_idx, /\(status, created_at\)/);
    assert.match(byName.facts_embedding_hnsw_idx, /USING hnsw .*vector_cosine_ops/);
    assert.match(byName.facts_status_published_at_idx, /\(status, published_at DESC\)/);
    assert.ok(byName.facts_source_key_key);
    assert.ok(byName.facts_content_hash_key);
    assert.ok(byName.fact_candidates_source_key_key);
    assert.ok(byName.fact_candidates_hook_hash_key);
  });

  it('enforces unique source_key / hook_hash on fact_candidates', async () => {
    await db.query(
      `insert into public.fact_candidates (source_key, source, hook_text, hook_hash)
       values ('enwiki-dyk:2019-03-14:3', 'enwiki_dyk', 'hook A', 'hash-a')`,
    );
    await rejects(
      db.query(
        `insert into public.fact_candidates (source_key, source, hook_text, hook_hash)
         values ('enwiki-dyk:2019-03-14:3', 'enwiki_dyk', 'hook B', 'hash-b')`,
      ),
      /fact_candidates_source_key_key/,
    );
    await rejects(
      db.query(
        `insert into public.fact_candidates (source_key, source, hook_text, hook_hash)
         values ('enwiki-dyk:2019-03-14:4', 'enwiki_dyk', 'hook A again', 'hash-a')`,
      ),
      /fact_candidates_hook_hash_key/,
    );
  });

  it('applies fact_candidates defaults, status CHECK and updated_at trigger', async () => {
    const inserted = await db.query(
      `insert into public.fact_candidates (source_key, source, hook_text, hook_hash, updated_at)
       values ('trwiki-bm:1', 'trwiki_bm', 'kanca', 'hash-tr', now() - interval '1 day')
       returning status, lang, attempts, source_meta, updated_at`,
    );
    const row = inserted.rows[0];
    assert.equal(row.status, 'new');
    assert.equal(row.lang, 'en');
    assert.equal(row.attempts, 0);
    assert.deepEqual(row.source_meta, {});

    const updated = await db.query(
      `update public.fact_candidates set status = 'scored'
       where source_key = 'trwiki-bm:1' returning updated_at`,
    );
    assert.ok(updated.rows[0].updated_at > row.updated_at);

    await rejects(
      db.query(
        `update public.fact_candidates set status = 'bogus' where source_key = 'trwiki-bm:1'`,
      ),
      /fact_candidates_status_check/,
    );
  });

  it('enforces unique source_key / content_hash on facts but allows NULLs', async () => {
    await db.query(
      `insert into public.facts (title, content, category, source_key, content_hash)
       values ('A', 'a', 'Bilim', 'enwiki-dyk:x:1', 'chash-1')`,
    );
    await rejects(
      db.query(
        `insert into public.facts (title, content, category, source_key)
         values ('B', 'b', 'Bilim', 'enwiki-dyk:x:1')`,
      ),
      /facts_source_key_key/,
    );
    await rejects(
      db.query(
        `insert into public.facts (title, content, category, content_hash)
         values ('C', 'c', 'Bilim', 'chash-1')`,
      ),
      /facts_content_hash_key/,
    );
    await rejects(
      db.query(
        `insert into public.facts (title, content, category, status) values ('D', 'd', 'Bilim', 'draft')`,
      ),
      /facts_status_check/,
    );

    const nulls = await db.query(
      'select count(*)::int as n from public.facts where source_key is null and content_hash is null',
    );
    assert.ok(nulls.rows[0].n >= 2, 'several facts with NULL source_key/content_hash coexist');
  });

  it('match_similar returns nearest facts (published+queued) and candidates', async () => {
    await db.query(
      `insert into public.facts (id, title, content, category, status, embedding) values
         ('10000000-0000-0000-0000-000000000001', 'Pub', 'published body', 'Bilim', 'published', $1),
         ('10000000-0000-0000-0000-000000000002', 'Que', 'queued body', 'Bilim', 'queued', $2),
         ('10000000-0000-0000-0000-000000000003', 'Arc', 'archived body', 'Bilim', 'archived', $1),
         ('10000000-0000-0000-0000-000000000004', 'Far', 'far body', 'Bilim', 'published', $3)`,
      [vec(0), vec(0, 1, 0.2), vec(500)],
    );
    await db.query(
      `insert into public.fact_candidates (id, source_key, source, hook_text, hook_hash, embedding)
       values ('20000000-0000-0000-0000-000000000001', 'wikidata:Q1', 'wikidata', 'candidate hook', 'hash-c1', $1)`,
      [vec(0, 2, 0.1)],
    );

    const { rows } = await asRole(
      'service_role',
      'select kind, id, text, similarity from public.match_similar($1::extensions.vector, 0.9, 10)',
      [vec(0)],
    );

    const ids = rows.map((r) => r.id);
    assert.deepEqual(ids, [
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
    ]);
    assert.equal(rows[0].kind, 'fact');
    assert.equal(rows[0].text, 'Pub\npublished body');
    assert.ok(Math.abs(rows[0].similarity - 1) < 1e-6);
    assert.equal(rows[1].kind, 'candidate');
    assert.equal(rows[1].text, 'candidate hook');
    assert.ok(!ids.includes('10000000-0000-0000-0000-000000000003'), 'archived excluded');
    assert.ok(!ids.includes('10000000-0000-0000-0000-000000000004'), 'below threshold excluded');

    const limited = await asRole(
      'service_role',
      'select id from public.match_similar($1::extensions.vector, 0.0, 1)',
      [vec(0)],
    );
    assert.equal(limited.rows.length, 1);
  });

  it('match_similar is SECURITY DEFINER with fixed search_path, executable only by service_role', async () => {
    const { rows } = await db.query(
      `select p.prosecdef, p.proconfig,
              has_function_privilege('anon', p.oid, 'execute') as anon_exec,
              has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
              has_function_privilege('service_role', p.oid, 'execute') as service_exec
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'match_similar'`,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].prosecdef, true);
    assert.deepEqual(rows[0].proconfig, ['search_path=""']);
    assert.equal(rows[0].anon_exec, false);
    assert.equal(rows[0].auth_exec, false);
    assert.equal(rows[0].service_exec, true);

    await rejects(
      asRole('anon', 'select * from public.match_similar($1::extensions.vector, 0.5, 5)', [vec(0)]),
      /permission denied/,
    );
  });

  it('anon / authenticated cannot read fact_candidates or pipeline_runs; service_role can', async () => {
    await db.query(`insert into public.pipeline_runs (trigger, ok) values ('test', true)`);

    for (const role of ['anon', 'authenticated']) {
      await rejects(asRole(role, 'select * from public.fact_candidates'), /permission denied/);
      await rejects(asRole(role, 'select * from public.pipeline_runs'), /permission denied/);
    }

    const candidates = await asRole(
      'service_role',
      'select count(*)::int as n from public.fact_candidates',
    );
    assert.ok(candidates.rows[0].n > 0);
    const runs = await asRole(
      'service_role',
      'select count(*)::int as n from public.pipeline_runs',
    );
    assert.equal(runs.rows[0].n, 1);

    const rls = await db.query(
      `select relname, relrowsecurity from pg_class
       where relname in ('fact_candidates', 'pipeline_runs') order by relname`,
    );
    assert.deepEqual(
      rls.rows.map((r) => r.relrowsecurity),
      [true, true],
    );
    const policies = await db.query(
      `select count(*)::int as n from pg_policies
       where tablename in ('fact_candidates', 'pipeline_runs')`,
    );
    assert.equal(policies.rows[0].n, 0);
  });

  it('even with table grants restored, RLS alone hides fact_candidates from anon', async () => {
    await db.exec('grant select on public.fact_candidates to anon');
    try {
      const { rows } = await asRole(
        'anon',
        'select count(*)::int as n from public.fact_candidates',
      );
      assert.equal(rows[0].n, 0);
    } finally {
      await db.exec('revoke all on public.fact_candidates from anon');
    }
  });

  it('anon sees only published facts', async () => {
    const { rows } = await asRole('anon', 'select id, status from public.facts');
    assert.ok(rows.length > 0);
    assert.ok(rows.every((r) => r.status === 'published'));

    const hidden = await asRole('anon', 'select id from public.facts where id = any($1::uuid[])', [
      [
        '00000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000003',
      ],
    ]);
    assert.equal(hidden.rows.length, 0, 'queued and archived facts are invisible to anon');
  });
});
