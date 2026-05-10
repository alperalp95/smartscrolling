create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('android', 'ios')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_user_token_key unique (user_id, expo_push_token)
);

create index if not exists push_tokens_user_enabled_idx
  on public.push_tokens (user_id, enabled);

create index if not exists push_tokens_expo_push_token_idx
  on public.push_tokens (expo_push_token);

alter table public.push_tokens enable row level security;

drop policy if exists "Users can select own push tokens" on public.push_tokens;
create policy "Users can select own push tokens"
  on public.push_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own push tokens" on public.push_tokens;
create policy "Users can insert own push tokens"
  on public.push_tokens
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own push tokens" on public.push_tokens;
create policy "Users can update own push tokens"
  on public.push_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
