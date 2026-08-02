-- Endurecimiento: el calendar_id de un evento debe pertenecer al mismo usuario

drop policy if exists "events_insert_own" on public.events;
drop policy if exists "events_update_own" on public.events;

create policy "events_insert_own" on public.events
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.calendars c
      where c.id = calendar_id
        and c.user_id = auth.uid()
    )
  );

create policy "events_update_own" on public.events
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.calendars c
      where c.id = calendar_id
        and c.user_id = auth.uid()
    )
  );

-- Excepciones solo sobre eventos propios
drop policy if exists "exceptions_insert_own" on public.event_exceptions;
drop policy if exists "exceptions_update_own" on public.event_exceptions;

create policy "exceptions_insert_own" on public.event_exceptions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and e.user_id = auth.uid()
    )
  );

create policy "exceptions_update_own" on public.event_exceptions
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and e.user_id = auth.uid()
    )
  );
