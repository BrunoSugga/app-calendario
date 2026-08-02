import type { SupabaseClient } from '@supabase/supabase-js'
import type { Calendar, CalendarEvent, EventDraft, EventException, TaskRun } from '../../types'
import { normalizeEventKind, normalizeTaskStatus } from '../../types'
import {
  sanitizeCalendarName,
  sanitizeColor,
  sanitizeEventDraft,
  sanitizeTaskNote,
} from '../security'
import type { CalendarRepository, CalendarSnapshot } from './types'

function mapEvent(row: Record<string, unknown>): CalendarEvent {
  const kind = normalizeEventKind(row.kind)
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    calendar_id: String(row.calendar_id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    all_day: Boolean(row.all_day),
    reminder_minutes: Number(row.reminder_minutes ?? 15),
    rrule: (row.rrule as string | null) ?? null,
    kind,
    task_status: normalizeTaskStatus(row.task_status, kind),
    task_started_at: (row.task_started_at as string | null) ?? null,
    task_completed_at: (row.task_completed_at as string | null) ?? null,
    task_duration_ms:
      typeof row.task_duration_ms === 'number' ? row.task_duration_ms : null,
    task_note: (row.task_note as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function isMissingRelationError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  const message = String(error.message ?? '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  )
}

function throwRepoError(error: { message?: string } | Error, fallback: string): never {
  const message =
    error instanceof Error
      ? error.message
      : typeof error.message === 'string' && error.message
        ? error.message
        : fallback
  throw new Error(message)
}

export function createCloudCalendarRepository(client: SupabaseClient): CalendarRepository {
  const load = async (): Promise<CalendarSnapshot> => {
    const [cRes, eRes, xRes, tRes] = await Promise.all([
      client.from('calendars').select('*').order('created_at'),
      client.from('events').select('*').order('starts_at'),
      client.from('event_exceptions').select('*'),
      client.from('task_runs').select('*').order('created_at', { ascending: false }),
    ])
    if (cRes.error) throwRepoError(cRes.error, 'No se pudieron cargar los calendarios')
    if (eRes.error) throwRepoError(eRes.error, 'No se pudieron cargar los eventos')
    if (xRes.error) throwRepoError(xRes.error, 'No se pudieron cargar las excepciones')

    let taskRuns: TaskRun[] = []
    if (tRes.error) {
      // Antes de correr 003_event_kinds.sql la tabla no existe: no bloquear el calendario.
      if (!isMissingRelationError(tRes.error)) {
        throwRepoError(tRes.error, 'No se pudo cargar el historial de tareas')
      }
    } else {
      taskRuns = (tRes.data ?? []) as TaskRun[]
    }

    return {
      calendars: (cRes.data ?? []) as Calendar[],
      events: ((eRes.data ?? []) as Record<string, unknown>[]).map(mapEvent),
      exceptions: (xRes.data ?? []) as EventException[],
      taskRuns,
    }
  }

  return {
    load,

    async toggleCalendarVisible(state, id) {
      const calendar = state.calendars.find((c) => c.id === id)
      if (!calendar) return state
      const { error } = await client
        .from('calendars')
        .update({ visible: !calendar.visible })
        .eq('id', id)
      if (error) throw error
      return load()
    },

    async setDefaultCalendar(_state, id, userId) {
      await client.from('calendars').update({ is_default: false }).eq('user_id', userId)
      const { error } = await client.from('calendars').update({ is_default: true }).eq('id', id)
      if (error) throw error
      return load()
    },

    async createCalendar(_state, userId, name, color) {
      const { error } = await client.from('calendars').insert({
        user_id: userId,
        name: sanitizeCalendarName(name),
        color: sanitizeColor(color),
        is_default: false,
        visible: true,
      })
      if (error) throw error
      return load()
    },

    async saveEvent(state, userId, draft: EventDraft) {
      draft = sanitizeEventDraft(draft)
      if (draft.id && draft.editScope === 'single' && draft.occurrenceOriginalStartsAt) {
        const row = {
          event_id: draft.id,
          user_id: userId,
          original_starts_at: draft.occurrenceOriginalStartsAt,
          is_cancelled: false,
          title: draft.title,
          description: draft.description,
          starts_at: draft.starts_at,
          ends_at: draft.ends_at,
          all_day: draft.all_day,
          reminder_minutes: draft.reminder_minutes,
        }
        const { error } = await client
          .from('event_exceptions')
          .upsert(row, { onConflict: 'event_id,original_starts_at' })
        if (error) {
          const { error: insertErr } = await client.from('event_exceptions').insert(row)
          if (insertErr) throw insertErr
        }
        return load()
      }

      const existing = draft.id ? state.events.find((e) => e.id === draft.id) : undefined
      const payload = {
        calendar_id: draft.calendar_id,
        title: draft.title,
        description: draft.description,
        starts_at: draft.starts_at,
        ends_at: draft.ends_at,
        all_day: draft.all_day,
        reminder_minutes: draft.reminder_minutes,
        rrule: draft.rrule,
        kind: draft.kind,
        task_status:
          draft.kind === 'task'
            ? existing?.kind === 'task'
              ? existing.task_status ?? 'pending'
              : 'pending'
            : null,
        task_started_at: draft.kind === 'task' ? (existing?.task_started_at ?? null) : null,
        task_completed_at: draft.kind === 'task' ? (existing?.task_completed_at ?? null) : null,
        task_duration_ms: draft.kind === 'task' ? (existing?.task_duration_ms ?? null) : null,
        task_note: draft.kind === 'task' ? (existing?.task_note ?? null) : null,
        updated_at: new Date().toISOString(),
      }

      if (draft.id) {
        const { error } = await client.from('events').update(payload).eq('id', draft.id)
        if (error) throw error
      } else {
        const { error } = await client.from('events').insert({
          ...payload,
          user_id: userId,
        })
        if (error) throw error
      }
      return load()
    },

    async deleteEvent(_state, userId, eventId, scope, originalStartsAt) {
      if (scope === 'single' && originalStartsAt) {
        const { error } = await client.from('event_exceptions').upsert(
          {
            event_id: eventId,
            user_id: userId,
            original_starts_at: originalStartsAt,
            is_cancelled: true,
            title: null,
            description: null,
            starts_at: null,
            ends_at: null,
            all_day: null,
            reminder_minutes: null,
          },
          { onConflict: 'event_id,original_starts_at' },
        )
        if (error) throw error
        return load()
      }

      const { error } = await client.from('events').delete().eq('id', eventId)
      if (error) throw error
      return load()
    },

    async startTask(_state, _userId, eventId) {
      const now = new Date().toISOString()
      const { error } = await client
        .from('events')
        .update({
          task_status: 'in_progress',
          task_started_at: now,
          task_completed_at: null,
          task_duration_ms: null,
          updated_at: now,
        })
        .eq('id', eventId)
        .eq('kind', 'task')
      if (error) throw error
      return load()
    },

    async completeTask(state, userId, eventId, note = '') {
      const event = state.events.find((e) => e.id === eventId)
      if (!event || event.kind !== 'task') return state
      const startedAt = event.task_started_at ? new Date(event.task_started_at) : new Date()
      const completedAt = new Date()
      const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime())
      const cleanNote = sanitizeTaskNote(note)
      const now = completedAt.toISOString()

      const { error: runErr } = await client.from('task_runs').insert({
        event_id: eventId,
        user_id: userId,
        started_at: startedAt.toISOString(),
        completed_at: now,
        duration_ms: durationMs,
        note: cleanNote,
      })
      if (runErr) throw runErr

      const { error } = await client
        .from('events')
        .update({
          task_status: 'done',
          task_started_at: startedAt.toISOString(),
          task_completed_at: now,
          task_duration_ms: durationMs,
          task_note: cleanNote || event.task_note,
          updated_at: now,
        })
        .eq('id', eventId)
      if (error) throw error
      return load()
    },

    subscribe(onChange) {
      const channel = client
        .channel('calendar-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calendars' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, onChange)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'event_exceptions' },
          onChange,
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_runs' }, onChange)
        .subscribe()

      return () => {
        void client.removeChannel(channel)
      }
    },
  }
}
