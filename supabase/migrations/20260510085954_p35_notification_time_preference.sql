alter table public.users
  add column if not exists notification_hour integer,
  add column if not exists notification_minute integer;

update public.users
set
  notification_hour = case
    when notification_hour between 0 and 23 then notification_hour
    else 20
  end,
  notification_minute = case
    when notification_minute between 0 and 59 then notification_minute
    else 0
  end
where notification_hour is null
  or notification_hour < 0
  or notification_hour > 23
  or notification_minute is null
  or notification_minute < 0
  or notification_minute > 59;

alter table public.users
  alter column notification_hour set default 20,
  alter column notification_hour set not null,
  alter column notification_minute set default 0,
  alter column notification_minute set not null;

do $$
begin
  alter table public.users
    add constraint users_notification_hour_range
    check (notification_hour between 0 and 23);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.users
    add constraint users_notification_minute_range
    check (notification_minute between 0 and 59);
exception
  when duplicate_object then null;
end $$;
