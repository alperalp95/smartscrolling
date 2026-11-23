-- Content pipeline v2: candidate pool, embeddings, publish queue, run metrics.
-- Spec: docs/specs/content-pipeline-v2.md (§5, §7, §9). Idempotent: safe to run twice.

-- 1. pgvector ------------------------------------------------------------------
create extension if not exists vector with schema extensions;

-- Shared updated_at trigger function (no earlier migration defines one).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. fact_candidates -------------------------------------------------------------
create table if not exists public.fact_candidates (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source text not null,
  lang text not null default 'en',
  hook_text text not null,
  hook_hash text not null,
  source_url text,
  source_meta jsonb default '{}'::jsonb,
  support_paragraph text,
  status text not null default 'new',
  scores jsonb,
  reject_reason text,
  embedding extensions.vector(1024),
  fact_id uuid references public.facts(id) on delete set null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fact_candidates_source_key_key unique (source_key),
  constraint fact_candidates_hook_hash_key unique (hook_hash),
  constraint fact_candidates_status_check check (
    status in ('new', 'scored', 'written', 'verified', 'queued', 'rejected')
  )
);

create index if not exists fact_candidates_status_created_at_idx
  on public.fact_candidates (status, created_at);

create index if not exists fact_candidates_embedding_hnsw_idx
  on public.fact_candidates using hnsw (embedding extensions.vector_cosine_ops);

drop trigger if exists fact_candidates_set_updated_at on public.fact_candidates;
create trigger fact_candidates_set_updated_at
  before update on public.fact_candidates
  for each row execute procedure public.set_updated_at();

-- RLS on, no policies: only service_role (bypassrls) can touch it.
alter table public.fact_candidates enable row level security;
revoke all on table public.fact_candidates from anon, authenticated;

-- 3. facts: new columns ----------------------------------------------------------
alter table public.facts
  add column if not exists source_key text,
  add column if not exists content_hash text,
  add column if not exists embedding extensions.vector(1024),
  add column if not exists wow_score numeric,
  add column if not exists verification jsonb,
  add column if not exists attribution text,
  add column if not exists status text not null default 'published',
  add column if not exists published_at timestamptz;

-- published_at already exists as DATE (20260409000000_schema_and_rls.sql).
-- Convert it to timestamptz once; existing rows get published_at = created_at.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'facts'
      and column_name = 'published_at'
      and data_type = 'date'
  ) then
    alter table public.facts
      alter column published_at type timestamptz
      using coalesce(created_at, published_at::timestamptz);
  end if;
end;
$$;

-- Existing rows: status is filled by the column default ('published');
-- any published row still missing published_at falls back to created_at.
update public.facts
set published_at = created_at
where status = 'published'
  and published_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'facts_source_key_key'
      and conrelid = 'public.facts'::regclass
  ) then
    alter table public.facts
      add constraint facts_source_key_key unique (source_key);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'facts_content_hash_key'
      and conrelid = 'public.facts'::regclass
  ) then
    alter table public.facts
      add constraint facts_content_hash_key unique (content_hash);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'facts_status_check'
      and conrelid = 'public.facts'::regclass
  ) then
    alter table public.facts
      add constraint facts_status_check
      check (status in ('queued', 'published', 'archived'));
  end if;
end;
$$;

create index if not exists facts_embedding_hnsw_idx
  on public.facts using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists facts_status_published_at_idx
  on public.facts (status, published_at desc);

-- Public read policy now only exposes published cards.
drop policy if exists "Anyone can read facts" on public.facts;
create policy "Anyone can read facts"
  on public.facts
  for select
  using (status = 'published');

-- 4. pipeline_runs ---------------------------------------------------------------
create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text,
  counts jsonb,
  provider_usage jsonb,
  errors jsonb,
  ok boolean
);

alter table public.pipeline_runs enable row level security;
revoke all on table public.pipeline_runs from anon, authenticated;

-- 5. match_similar RPC -----------------------------------------------------------
-- Nearest neighbours (cosine) across facts (published + queued) and candidates.
-- Each side is ordered by distance + limited so the HNSW indexes are used.
create or replace function public.match_similar(
  p_embedding extensions.vector(1024),
  p_threshold float,
  p_limit int
)
returns table (kind text, id uuid, text text, similarity float)
language sql
stable
security definer
set search_path = ''
as $$
  select m.kind, m.id, m.text, m.similarity
  from (
    (
      select
        'fact'::text as kind,
        f.id,
        f.title || E'\n' || f.content as text,
        (1 - (f.embedding operator(extensions.<=>) p_embedding))::float as similarity
      from public.facts f
      where f.embedding is not null
        and f.status in ('published', 'queued')
      order by f.embedding operator(extensions.<=>) p_embedding
      limit p_limit
    )
    union all
    (
      select
        'candidate'::text as kind,
        c.id,
        c.hook_text as text,
        (1 - (c.embedding operator(extensions.<=>) p_embedding))::float as similarity
      from public.fact_candidates c
      where c.embedding is not null
      order by c.embedding operator(extensions.<=>) p_embedding
      limit p_limit
    )
  ) m
  where m.similarity >= p_threshold
  order by m.similarity desc
  limit p_limit;
$$;

revoke all on function public.match_similar(extensions.vector, float, int)
  from public, anon, authenticated;
grant execute on function public.match_similar(extensions.vector, float, int)
  to service_role;
