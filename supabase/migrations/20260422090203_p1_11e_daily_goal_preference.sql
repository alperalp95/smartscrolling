alter table public.users
  add column if not exists daily_goal_type text,
  add column if not exists daily_goal_value integer;
