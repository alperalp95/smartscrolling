-- Card AI foundation (K-01). Idempotent: safe to run twice.

-- 1. ai_usage: per-user daily AI call counter (service_role only) ---------------
create table if not exists public.ai_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;

-- 2. consume_ai_quota: atomic "take one" against a daily limit -------------------
create or replace function public.consume_ai_quota(p_user_id uuid, p_limit int)
returns table (allowed boolean, used int, remaining int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.ai_usage as u (user_id, day, count, updated_at)
  values (p_user_id, (now() at time zone 'utc')::date, 1, now())
  on conflict (user_id, day) do update
    set count = u.count + 1, updated_at = now()
    where u.count < p_limit
  returning u.count into v_count;

  if v_count is null then
    return query select false, p_limit, 0;
  else
    return query select true, v_count, p_limit - v_count;
  end if;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, int) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, int) to service_role;

-- 3. facts.context_text ----------------------------------------------------------
alter table public.facts add column if not exists context_text text;

alter table public.facts drop constraint if exists facts_context_text_len_check;
alter table public.facts
  add constraint facts_context_text_len_check
  check (context_text is null or char_length(context_text) <= 2400);

-- 4. ai_content_reports.fact_id (book_id stays until phase 3) ---------------------
alter table public.ai_content_reports
  add column if not exists fact_id uuid references public.facts(id) on delete set null;

create index if not exists ai_content_reports_fact_id_idx
  on public.ai_content_reports (fact_id);
