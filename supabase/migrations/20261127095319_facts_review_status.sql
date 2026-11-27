-- V2-17: hassas kelime geçen kartlar reddedilmez, 'review' (incelemede) durumunda bekler.
-- Uygulama sadece 'published', yayın adımı sadece 'queued' okur; 'review' kart ne yayınlanır ne stok sayılır.
alter table public.facts drop constraint facts_status_check;
alter table public.facts add constraint facts_status_check
  check (status = any (array['queued'::text, 'published'::text, 'archived'::text, 'review'::text]));

-- Tekrar kontrolü incelemedeki kartları da görsün (aynı bilgi ikinci kez yazılmasın).
create or replace function public.match_similar(
  p_embedding extensions.vector,
  p_threshold double precision,
  p_limit integer,
  p_kinds text[] default array['fact'::text, 'candidate'::text],
  p_exclude_candidate uuid default null::uuid
)
returns table(kind text, id uuid, text text, similarity double precision)
language sql
stable security definer
set search_path to ''
as $function$
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
        and f.status in ('published', 'queued', 'review')
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
$function$;
