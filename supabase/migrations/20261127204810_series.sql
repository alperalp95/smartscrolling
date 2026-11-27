-- Seriler: Vikipedi maddelerinden kesintisiz kart serileri.
-- Tablolar: series, series_cards, series_progress. RLS: premium onizleme (ilk N kart).
-- replace_series_cards: kartlari tek islemde degistirir (yalniz service_role).
-- Idempotent: tekrar calistirilabilir.

-- Onizleme kart sayisi: tek yerde; mobil ayari (src/config/series.ts) ile ayni olmali.
create or replace function public.series_preview_cards()
returns int
language sql
immutable
set search_path = ''
as $$ select 3 $$;

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  category text,
  cover_url text,
  source_title text not null,
  source_url text not null,
  source_revid bigint,
  license text not null default 'CC BY-SA 4.0',
  card_count int not null default 0,
  section_count int not null default 0,
  sections jsonb not null default '[]'::jsonb,
  is_free boolean not null default false,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.series_cards (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series (id) on delete cascade,
  position int not null check (position >= 1),
  section_title text not null default '',
  body text not null,
  unique (series_id, position)
);

create table if not exists public.series_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id uuid not null references public.series (id) on delete cascade,
  last_position int not null default 0 check (last_position >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

create index if not exists series_status_published_at_idx
  on public.series (status, published_at desc);
create index if not exists series_cards_series_position_idx
  on public.series_cards (series_id, position);
create index if not exists series_progress_series_idx
  on public.series_progress (series_id);

alter table public.series enable row level security;
alter table public.series_cards enable row level security;
alter table public.series_progress enable row level security;

-- Yetkiler: istemci yalniz okur (progress: kendi satiri icin yazar). Yazma service_role.
revoke all on public.series, public.series_cards, public.series_progress from anon, authenticated;
grant select on public.series, public.series_cards to anon, authenticated;
grant select, insert, update, delete on public.series_progress to authenticated;

drop policy if exists series_select_published on public.series;
create policy series_select_published on public.series
  for select to anon, authenticated
  using (status = 'published');

-- Kart okunur: seri yayinda VE (ucretsiz VEYA ilk N kart VEYA app_metadata.premium).
-- app_metadata kullanici tarafindan degistirilemez (user_metadata kullanilmaz).
drop policy if exists series_cards_select_preview_or_premium on public.series_cards;
create policy series_cards_select_preview_or_premium on public.series_cards
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.series s
      where s.id = series_cards.series_id
        and s.status = 'published'
        and (
          s.is_free
          or series_cards.position <= public.series_preview_cards()
          or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'premium')::boolean, false)
        )
    )
  );

drop policy if exists series_progress_own on public.series_progress;
create policy series_progress_own on public.series_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Kartlari tek islemde degistirir; okuyan bos kalmaz. Ilerleme yeni kart sayisina kirpilir.
-- p_cards: [{ "position": 1, "section_title": "...", "body": "..." }, ...]
create or replace function public.replace_series_cards(p_series_id uuid, p_cards jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' then
    raise exception 'p_cards must be a json array';
  end if;

  perform 1 from public.series where id = p_series_id for update;
  if not found then
    raise exception 'series not found: %', p_series_id;
  end if;

  delete from public.series_cards where series_id = p_series_id;

  insert into public.series_cards (series_id, position, section_title, body)
  select p_series_id, c.position, coalesce(c.section_title, ''), c.body
  from jsonb_to_recordset(p_cards) as c(position int, section_title text, body text);

  select count(*)::int into v_count
  from public.series_cards where series_id = p_series_id;

  update public.series
  set card_count = v_count, updated_at = now()
  where id = p_series_id;

  update public.series_progress
  set last_position = least(last_position, v_count)
  where series_id = p_series_id and last_position > v_count;
end;
$$;

revoke all on function public.replace_series_cards(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_series_cards(uuid, jsonb) to service_role;
