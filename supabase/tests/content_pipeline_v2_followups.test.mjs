// Verifies supabase/migrations/20261123085302_content_pipeline_v2_followups.sql on PGlite:
// match_similar (p_kinds, rejected excluded, p_exclude_candidate), pipeline_state,
// and how a JS number[] reaches a vector column through PostgREST-style JSON bodies.
// Same Supabase stubs as content_pipeline_v2.test.mjs; earlier migrations run first,
// then V2 + follow-ups are applied twice.
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
  '20260409000000_schema_and_rls.sql',
  '20260419140942_p2_03g_fact_visual_key.sql',
];
const V2_MIGRATION = '20261123085248_content_pipeline_v2.sql';
const FOLLOWUPS_MIGRATION = '20261123085302_content_pipeline_v2_followups.sql';

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

const DIM = 1024;

function vecValues(axis, mixAxis = null, mix = 0) {
  const values = new Array(DIM).fill(0);
  values[axis] = 1;
  if (mixAxis !== null) values[mixAxis] = mix;
  return values;
}
const vec = (...args) => `[${vecValues(...args).join(',')}]`;

const F_PUB = '10000000-0000-0000-0000-000000000001';
const F_QUE = '10000000-0000-0000-0000-000000000002';
const F_ARC = '10000000-0000-0000-0000-000000000003';
const C_NEW = '20000000-0000-0000-0000-000000000001';
const C_QUEUED = '20000000-0000-0000-0000-000000000002';
const C_REJECTED = '20000000-0000-0000-0000-000000000003';
const C_SELF = '20000000-0000-0000-0000-000000000004';

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

const MATCH = 'select kind, id, similarity from public.match_similar';

describe('content pipeline v2 follow-ups migration', () => {
  before(async () => {
    db = new PGlite({ extensions: { vector, uuid_ossp } });
    await db.exec(SUPABASE_STUBS);
    for (const name of PRIOR_MIGRATIONS) {
      await db.exec(readMigration(name));
    }
    await db.exec(readMigration(V2_MIGRATION));
    await db.exec(readMigration(FOLLOWUPS_MIGRATION));

    await db.query(
      `insert into public.facts (id, title, content, category, status, embedding) values
         ($1, 'Pub', 'published body', 'Bilim', 'published', $4),
         ($2, 'Que', 'queued body', 'Bilim', 'queued', $5),
         ($3, 'Arc', 'archived body', 'Bilim', 'archived', $4)`,
      [F_PUB, F_QUE, F_ARC, vec(0), vec(0, 1, 0.2)],
    );
    await db.query(
      `insert into public.fact_candidates (id, source_key, source, hook_text, hook_hash, status, embedding) values
         ($1, 's:new', 'test', 'new hook', 'h-new', 'new', $5),
         ($2, 's:queued', 'test', 'queued hook', 'h-queued', 'queued', $6),
         ($3, 's:rejected', 'test', 'rejected hook', 'h-rejected', 'rejected', $5),
         ($4, 's:self', 'test', 'self hook', 'h-self', 'scored', $7)`,
      [C_NEW, C_QUEUED, C_REJECTED, C_SELF, vec(0, 2, 0.1), vec(0, 3, 0.3), vec(0)],
    );
  });

  after(async () => {
    await db?.close();
  });

  it('is idempotent: V2 + follow-ups re-run cleanly and keep data', async () => {
    await db.query(
      `insert into public.pipeline_state (key, value) values ('cursor:idem', '{"n":1}')`,
    );

    await db.exec(readMigration(V2_MIGRATION));
    await db.exec(readMigration(FOLLOWUPS_MIGRATION));

    const state = await db.query(
      `select value from public.pipeline_state where key = 'cursor:idem'`,
    );
    assert.deepEqual(state.rows[0].value, { n: 1 });
    const candidates = await db.query('select count(*)::int as n from public.fact_candidates');
    assert.equal(candidates.rows[0].n, 4);
    const triggers = await db.query(
      `select count(*)::int as n from pg_trigger
       where tgrelid = 'public.pipeline_state'::regclass and not tgisinternal`,
    );
    assert.equal(triggers.rows[0].n, 1);
  });

  it('keeps exactly one match_similar: the new 5-arg signature with defaults', async () => {
    const { rows } = await db.query(
      `select pg_get_function_identity_arguments(p.oid) as args,
              pg_get_function_arguments(p.oid) as full_args,
              p.prosecdef, p.proconfig
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'match_similar'`,
    );
    assert.equal(rows.length, 1, 'old 3-arg overload dropped');
    assert.match(rows[0].args, /p_kinds text\[\], p_exclude_candidate uuid$/);
    assert.match(
      rows[0].full_args,
      /p_kinds text\[\] DEFAULT ARRAY\['fact'::text, 'candidate'::text\]/,
    );
    assert.match(rows[0].full_args, /p_exclude_candidate uuid DEFAULT NULL/);
    assert.equal(rows[0].prosecdef, true);
    assert.deepEqual(rows[0].proconfig, ['search_path=""']);
  });

  it('default p_kinds returns facts (published+queued) and non-rejected candidates', async () => {
    const { rows } = await asRole('service_role', `${MATCH}($1::extensions.vector, 0.9, 10)`, [
      vec(0),
    ]);
    const ids = rows.map((r) => r.id);
    assert.deepEqual(new Set(ids), new Set([F_PUB, F_QUE, C_NEW, C_QUEUED, C_SELF]));
    assert.ok(!ids.includes(F_ARC), 'archived fact excluded');
    assert.ok(!ids.includes(C_REJECTED), 'rejected candidate excluded');
    for (let i = 1; i < rows.length; i += 1) {
      assert.ok(rows[i - 1].similarity >= rows[i].similarity, 'ordered by similarity desc');
    }
  });

  it("p_kinds = {'fact'} / {'candidate'} restricts the side", async () => {
    const facts = await asRole(
      'service_role',
      `${MATCH}($1::extensions.vector, 0.0, 10, array['fact'])`,
      [vec(0)],
    );
    assert.ok(facts.rows.length > 0);
    assert.ok(facts.rows.every((r) => r.kind === 'fact'));
    assert.deepEqual(new Set(facts.rows.map((r) => r.id)), new Set([F_PUB, F_QUE]));

    const candidates = await asRole(
      'service_role',
      `${MATCH}($1::extensions.vector, 0.0, 10, array['candidate'])`,
      [vec(0)],
    );
    assert.ok(candidates.rows.every((r) => r.kind === 'candidate'));
    assert.deepEqual(new Set(candidates.rows.map((r) => r.id)), new Set([C_NEW, C_QUEUED, C_SELF]));

    const none = await asRole(
      'service_role',
      `${MATCH}($1::extensions.vector, 0.0, 10, array[]::text[])`,
      [vec(0)],
    );
    assert.equal(none.rows.length, 0);
  });

  it('p_exclude_candidate drops only that candidate (no self-match)', async () => {
    const withSelf = await asRole(
      'service_role',
      `${MATCH}($1::extensions.vector, 0.999, 10, array['candidate'])`,
      [vec(0)],
    );
    assert.deepEqual(
      withSelf.rows.map((r) => r.id),
      [C_SELF],
    );

    const { rows } = await asRole(
      'service_role',
      `${MATCH}($1::extensions.vector, 0.0, 10, array['fact','candidate'], $2::uuid)`,
      [vec(0), C_SELF],
    );
    const ids = rows.map((r) => r.id);
    assert.ok(!ids.includes(C_SELF));
    assert.ok(ids.includes(C_NEW) && ids.includes(C_QUEUED) && ids.includes(F_PUB));

    const named = await asRole(
      'service_role',
      `${MATCH}(p_embedding => $1::extensions.vector, p_threshold => 0.0, p_limit => 10,
                p_exclude_candidate => $2::uuid)`,
      [vec(0), C_SELF],
    );
    assert.ok(!named.rows.some((r) => r.id === C_SELF), 'named args (PostgREST style) work');
  });

  it('match_similar is executable only by service_role', async () => {
    const { rows } = await db.query(
      `select has_function_privilege('anon', p.oid, 'execute') as anon_exec,
              has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
              has_function_privilege('service_role', p.oid, 'execute') as service_exec
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'match_similar'`,
    );
    assert.deepEqual(rows[0], { anon_exec: false, auth_exec: false, service_exec: true });
    for (const role of ['anon', 'authenticated']) {
      await rejects(
        asRole(role, `${MATCH}($1::extensions.vector, 0.5, 5)`, [vec(0)]),
        /permission denied/,
      );
    }
  });

  it('pipeline_state: upsert by key, default value, updated_at trigger', async () => {
    const first = await asRole(
      'service_role',
      `insert into public.pipeline_state (key) values ('cursor:s1')
       returning value, updated_at`,
    );
    assert.deepEqual(first.rows[0].value, {});

    await db.query(
      `update public.pipeline_state set updated_at = now() - interval '1 day' where key = 'cursor:s1'`,
    );
    const before = await db.query(
      `select updated_at from public.pipeline_state where key = 'cursor:s1'`,
    );

    const upsert = await asRole(
      'service_role',
      `insert into public.pipeline_state (key, value) values ('cursor:s1', $1::jsonb)
       on conflict (key) do update set value = excluded.value
       returning value, updated_at`,
      [JSON.stringify({ month: '2024-02', offset: 120 })],
    );
    assert.deepEqual(upsert.rows[0].value, { month: '2024-02', offset: 120 });
    assert.ok(upsert.rows[0].updated_at > before.rows[0].updated_at, 'trigger bumps updated_at');

    const count = await db.query(
      `select count(*)::int as n from public.pipeline_state where key = 'cursor:s1'`,
    );
    assert.equal(count.rows[0].n, 1);

    await rejects(
      db.query(`insert into public.pipeline_state (key, value) values ('cursor:x', null)`),
      /null value in column "value"/,
    );
  });

  it('pipeline_state: RLS on, no policies, anon/authenticated denied', async () => {
    for (const role of ['anon', 'authenticated']) {
      await rejects(asRole(role, 'select * from public.pipeline_state'), /permission denied/);
      await rejects(
        asRole(role, `insert into public.pipeline_state (key) values ('cursor:evil')`),
        /permission denied/,
      );
    }
    const rls = await db.query(
      `select relrowsecurity from pg_class where oid = 'public.pipeline_state'::regclass`,
    );
    assert.equal(rls.rows[0].relrowsecurity, true);
    const policies = await db.query(
      `select count(*)::int as n from pg_policies where tablename = 'pipeline_state'`,
    );
    assert.equal(policies.rows[0].n, 0);

    await db.exec('grant select on public.pipeline_state to anon');
    try {
      const { rows } = await asRole('anon', 'select count(*)::int as n from public.pipeline_state');
      assert.equal(rows[0].n, 0, 'RLS alone hides rows even with a stray grant');
    } finally {
      await db.exec('revoke all on public.pipeline_state from anon');
    }
  });

  // PostgREST turns a JSON request body into rows with json_to_recordset / json_populate_recordset
  // (inserts) and json_to_record (RPC args). A JSON value that is not a string is handed to the
  // column type's input function as its JSON text, so a JS number[] becomes '[0.1,0.2,...]',
  // which is exactly pgvector's text format.
  describe('vector over PostgREST-style JSON bodies', () => {
    const embedding = vecValues(7, 8, 0.5);

    it('insert: a plain JS number[] is accepted (json_to_recordset)', async () => {
      const body = JSON.stringify([
        { source_key: 'pgrst:array', source: 't', hook_text: 'a', hook_hash: 'pg-a', embedding },
      ]);
      await db.query(
        `insert into public.fact_candidates (source_key, source, hook_text, hook_hash, embedding)
         select source_key, source, hook_text, hook_hash, embedding
         from json_to_recordset($1::json)
           as _(source_key text, source text, hook_text text, hook_hash text,
                embedding extensions.vector(1024))`,
        [body],
      );
      const { rows } = await db.query(
        `select embedding::text as t from public.fact_candidates where source_key = 'pgrst:array'`,
      );
      assert.deepEqual(JSON.parse(rows[0].t), embedding);
    });

    it('insert: the string form "[...]" is accepted too (json_populate_recordset, jsonb)', async () => {
      const body = JSON.stringify([
        {
          source_key: 'pgrst:string',
          source: 't',
          hook_text: 'b',
          hook_hash: 'pg-b',
          embedding: JSON.stringify(embedding),
        },
      ]);
      await db.query(
        `insert into public.fact_candidates (source_key, source, hook_text, hook_hash, embedding)
         select source_key, source, hook_text, hook_hash, embedding
         from jsonb_populate_recordset(null::public.fact_candidates, $1::jsonb)`,
        [body],
      );
      const { rows } = await db.query(
        `select embedding::text as t from public.fact_candidates where source_key = 'pgrst:string'`,
      );
      assert.deepEqual(JSON.parse(rows[0].t), embedding);
    });

    it('insert: wrong dimension is rejected', async () => {
      const body = JSON.stringify([{ embedding: [0.1, 0.2, 0.3] }]);
      await rejects(
        db.query(
          'select embedding from json_to_recordset($1::json) as _(embedding extensions.vector(1024))',
          [body],
        ),
        /expected 1024 dimensions, not 3/,
      );
    });

    it('rpc: match_similar args from a JSON object with a number[] (json_to_record)', async () => {
      const body = JSON.stringify({
        p_embedding: vecValues(0),
        p_threshold: 0.99,
        p_limit: 5,
        p_kinds: ['fact'],
      });
      const { rows } = await asRole(
        'service_role',
        `select m.id from json_to_record($1::json)
           as a(p_embedding extensions.vector(1024), p_threshold float, p_limit int, p_kinds text[]),
         lateral public.match_similar(a.p_embedding, a.p_threshold, a.p_limit, a.p_kinds) m`,
        [body],
      );
      assert.deepEqual(
        rows.map((r) => r.id),
        [F_PUB],
      );
    });

    it('select: vector comes back to JSON as a string, not an array', async () => {
      const { rows } = await db.query(
        `select json_build_object('embedding', embedding)::text as j
         from public.fact_candidates where source_key = 'pgrst:array'`,
      );
      const parsed = JSON.parse(rows[0].j);
      assert.equal(typeof parsed.embedding, 'string');
      assert.deepEqual(JSON.parse(parsed.embedding), embedding);
    });
  });
});
