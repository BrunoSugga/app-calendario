-- Preferencias de semana laboral por usuario (sync web/desktop)

create table if not exists public.work_week_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  work_calendar_id uuid references public.calendars (id) on delete set null,
  work_days smallint[] not null default '{1,2,3,4,5}',
  start_minute integer not null default 480,
  end_minute integer not null default 1020,
  mute_outside_hours boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint work_week_settings_days_valid check (
    work_days <> '{}'
    and work_days <@ '{1,2,3,4,5,6,7}'::smallint[]
  ),
  constraint work_week_settings_minutes_range check (
    start_minute >= 0
    and start_minute < 1440
    and end_minute > 0
    and end_minute <= 1440
    and start_minute < end_minute
  )
);

create or replace function public.work_week_settings_calendar_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.work_calendar_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.calendars c
    where c.id = new.work_calendar_id
      and c.user_id = new.user_id
  ) then
    raise exception 'work_calendar_id must belong to the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists work_week_settings_calendar_owner on public.work_week_settings;
create trigger work_week_settings_calendar_owner
  before insert or update of work_calendar_id, user_id
  on public.work_week_settings
  for each row
  execute function public.work_week_settings_calendar_owner();

alter table public.work_week_settings enable row level security;

drop policy if exists "work_week_settings_select_own" on public.work_week_settings;
create policy "work_week_settings_select_own" on public.work_week_settings
  for select using (auth.uid() = user_id);

drop policy if exists "work_week_settings_insert_own" on public.work_week_settings;
create policy "work_week_settings_insert_own" on public.work_week_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "work_week_settings_update_own" on public.work_week_settings;
create policy "work_week_settings_update_own" on public.work_week_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "work_week_settings_delete_own" on public.work_week_settings;
create policy "work_week_settings_delete_own" on public.work_week_settings
  for delete using (auth.uid() = user_id);
