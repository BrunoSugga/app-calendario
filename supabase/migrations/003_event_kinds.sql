-- Tipos de ítem: event | reminder | task + historial de tareas

alter table public.events
  add column if not exists kind text not null default 'event',
  add column if not exists task_status text,
  add column if not exists task_started_at timestamptz,
  add column if not exists task_completed_at timestamptz,
  add column if not exists task_duration_ms bigint,
  add column if not exists task_note text;

alter table public.events drop constraint if exists events_kind_check;
alter table public.events
  add constraint events_kind_check check (kind in ('event', 'reminder', 'task'));

alter table public.events drop constraint if exists events_task_status_check;
alter table public.events
  add constraint events_task_status_check
  check (task_status is null or task_status in ('pending', 'in_progress', 'done'));

update public.events
set task_status = 'pending'
where kind = 'task' and task_status is null;

create table if not exists public.task_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_ms bigint not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists task_runs_event_id_idx on public.task_runs (event_id);
create index if not exists task_runs_user_id_idx on public.task_runs (user_id);

alter table public.task_runs enable row level security;

drop policy if exists "task_runs_select_own" on public.task_runs;
drop policy if exists "task_runs_insert_own" on public.task_runs;
drop policy if exists "task_runs_update_own" on public.task_runs;
drop policy if exists "task_runs_delete_own" on public.task_runs;

create policy "task_runs_select_own" on public.task_runs
  for select using (auth.uid() = user_id);
create policy "task_runs_insert_own" on public.task_runs
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = auth.uid() and e.kind = 'task'
    )
  );
create policy "task_runs_update_own" on public.task_runs
  for update using (auth.uid() = user_id);
create policy "task_runs_delete_own" on public.task_runs
  for delete using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.task_runs;
exception
  when duplicate_object then null;
end $$;
