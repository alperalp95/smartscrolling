-- Content pipeline v2 follow-ups (V2-01b). Idempotent: safe to run twice.
-- Depends on 20261120120000_content_pipeline_v2.sql (vector, set_updated_at,
-- fact_candidates, facts.status/embedding).

-- 1. match_similar: kind filter, rejected candidates out, self-exclude ----------
-- The old 3-arg signature is dropped (pipeline moves to the new one; not in prod).
drop function if exists public.match_similar(extensions.vector, float, int);

-- Nearest neighbours (cosine) across facts (published + queued) and candidates
-- (any status except rejected). p_kinds picks the sides ('fact', 'candidate');
-- p_exclude_candidate drops one candidate (usually the one being checked).
-- Each side is ordered by distance + limited so the HNSW indexes are used.
create or replace function public.match_similar(
  p_embedding extensions.vector(1024),
  p_threshold float,
  p_limit int,
  p_kinds text[] default array['fact', 'candidate'],
  p_exclude_candidate uuid default null
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
      where 'fact' = any (p_kinds)
        and f.embedding is not null
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
      where 'candidate' = any (p_kinds)
        and c.embedding is not null
        and c.status <> 'rejected'
        and (p_exclude_candidate is null or c.id <> p_exclude_candidate)
      order by c.embedding operator(extensions.<=>) p_embedding
      limit p_limit
    )
  ) m
  where m.similarity >= p_threshold
  order by m.similarity desc
  limit p_limit;
$$;

revoke all on function public.match_similar(extensions.vector, float, int, text[], uuid)
  from public, anon, authenticated;
grant execute on function public.match_similar(extensions.vector, float, int, text[], uuid)
  to service_role;

-- 2. pipeline_state: small key/value store (e.g. source cursors 'cursor:s1') ----
create table if not exists public.pipeline_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists pipeline_state_set_updated_at on public.pipeline_state;
create trigger pipeline_state_set_updated_at
  before update on public.pipeline_state
  for each row execute procedure public.set_updated_at();

-- RLS on, no policies: only service_role (bypassrls) can touch it.
alter table public.pipeline_state enable row level security;
revoke all on table public.pipeline_state from anon, authenticated;
