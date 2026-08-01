-- Calendario: esquema inicial + RLS + Realtime

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#5B9BD5',
  is_default boolean not null default false,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  reminder_minutes integer not null default 15,
  rrule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  original_starts_at timestamptz not null,
  is_cancelled boolean not null default false,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  reminder_minutes integer,
  created_at timestamptz not null default now()
);

create index if not exists calendars_user_id_idx on public.calendars (user_id);
create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_calendar_id_idx on public.events (calendar_id);
create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists event_exceptions_event_id_idx on public.event_exceptions (event_id);
create unique index if not exists event_exceptions_unique_occurrence
  on public.event_exceptions (event_id, original_starts_at);

alter table public.profiles enable row level security;
alter table public.calendars enable row level security;
alter table public.events enable row level security;
alter table public.event_exceptions enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "calendars_select_own" on public.calendars
  for select using (auth.uid() = user_id);
create policy "calendars_insert_own" on public.calendars
  for insert with check (auth.uid() = user_id);
create policy "calendars_update_own" on public.calendars
  for update using (auth.uid() = user_id);
create policy "calendars_delete_own" on public.calendars
  for delete using (auth.uid() = user_id);

create policy "events_select_own" on public.events
  for select using (auth.uid() = user_id);
create policy "events_insert_own" on public.events
  for insert with check (auth.uid() = user_id);
create policy "events_update_own" on public.events
  for update using (auth.uid() = user_id);
create policy "events_delete_own" on public.events
  for delete using (auth.uid() = user_id);

create policy "exceptions_select_own" on public.event_exceptions
  for select using (auth.uid() = user_id);
create policy "exceptions_insert_own" on public.event_exceptions
  for insert with check (auth.uid() = user_id);
create policy "exceptions_update_own" on public.event_exceptions
  for update using (auth.uid() = user_id);
create policy "exceptions_delete_own" on public.event_exceptions
  for delete using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.calendars (user_id, name, color, is_default, visible)
  values (new.id, 'Calendario de ' || coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), '#2F7FD4', true, true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.calendars;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_exceptions;
