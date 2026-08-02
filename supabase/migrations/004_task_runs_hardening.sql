-- Endurece políticas de task_runs: update/delete solo si el evento propio sigue existiendo

drop policy if exists "task_runs_update_own" on public.task_runs;
drop policy if exists "task_runs_delete_own" on public.task_runs;

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
