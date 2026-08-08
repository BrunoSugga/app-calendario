-- Hardening: WITH CHECK estricto + constraints de integridad alineados con security.ts

-- Calendars: update no puede cambiar de dueño
drop policy if exists "calendars_update_own" on public.calendars;
create policy "calendars_update_own" on public.calendars
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Events: delete ya usa using; asegurar update/insert (reaplicar 002 por claridad)
drop policy if exists "events_insert_own" on public.events;
drop policy if exists "events_update_own" on public.events;
drop policy if exists "events_delete_own" on public.events;

create policy "events_insert_own" on public.events
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.calendars c
      where c.id = calendar_id and c.user_id = auth.uid()
    )
  );

create policy "events_update_own" on public.events
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.calendars c
      where c.id = calendar_id and c.user_id = auth.uid()
    )
  );

create policy "events_delete_own" on public.events
  for delete using (auth.uid() = user_id);

-- Exceptions
drop policy if exists "exceptions_insert_own" on public.event_exceptions;
drop policy if exists "exceptions_update_own" on public.event_exceptions;
drop policy if exists "exceptions_delete_own" on public.event_exceptions;

create policy "exceptions_insert_own" on public.event_exceptions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = auth.uid()
    )
  );

create policy "exceptions_update_own" on public.event_exceptions
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = auth.uid()
    )
  );

create policy "exceptions_delete_own" on public.event_exceptions
  for delete using (auth.uid() = user_id);

-- task_runs insert/select ya endurecidos; reafirmar update/delete
drop policy if exists "task_runs_insert_own" on public.task_runs;
drop policy if exists "task_runs_update_own" on public.task_runs;
drop policy if exists "task_runs_delete_own" on public.task_runs;

create policy "task_runs_insert_own" on public.task_runs
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = auth.uid() and e.kind = 'task'
    )
  );

create policy "task_runs_update_own" on public.task_runs
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = auth.uid() and e.kind = 'task'
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = auth.uid() and e.kind = 'task'
    )
  );

create policy "task_runs_delete_own" on public.task_runs
  for delete using (
    auth.uid() = user_id
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = auth.uid() and e.kind = 'task'
    )
  );

-- Constraints de longitud / formato (paridad con src/lib/security.ts)
alter table public.calendars drop constraint if exists calendars_name_len;
alter table public.calendars
  add constraint calendars_name_len check (char_length(name) between 1 and 120);

alter table public.calendars drop constraint if exists calendars_color_hex;
alter table public.calendars
  add constraint calendars_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.events drop constraint if exists events_title_len;
alter table public.events
  add constraint events_title_len check (char_length(title) between 1 and 200);

alter table public.events drop constraint if exists events_description_len;
alter table public.events
  add constraint events_description_len check (char_length(description) <= 5000);

alter table public.events drop constraint if exists events_rrule_len;
alter table public.events
  add constraint events_rrule_len check (rrule is null or char_length(rrule) <= 300);

alter table public.events drop constraint if exists events_reminder_range;
alter table public.events
  add constraint events_reminder_range check (reminder_minutes between 0 and 10080);

alter table public.events drop constraint if exists events_task_note_len;
alter table public.events
  add constraint events_task_note_len check (task_note is null or char_length(task_note) <= 2000);

alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles
  add constraint profiles_display_name_len check (
    display_name is null or char_length(display_name) <= 120
  );

alter table public.task_runs drop constraint if exists task_runs_note_len;
alter table public.task_runs
  add constraint task_runs_note_len check (char_length(note) <= 2000);
