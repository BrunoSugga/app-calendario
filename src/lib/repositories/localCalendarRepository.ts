import type { Calendar, CalendarEvent, EventDraft, EventException, TaskRun } from '../../types'
import { createId } from '../id'
import { loadLocalDb, saveLocalDb } from '../localStore'
import {
  sanitizeCalendarName,
  sanitizeColor,
  sanitizeEventDraft,
  sanitizeTaskNote,
} from '../security'
import type { CalendarRepository, CalendarSnapshot } from './types'
import { emptySnapshot } from './types'

function readSnapshot(): CalendarSnapshot {
  const db = loadLocalDb()
  if (!db) return emptySnapshot()
  return {
    calendars: db.calendars,
    events: db.events,
    exceptions: db.exceptions,
    taskRuns: db.taskRuns ?? [],
  }
}

function writeSnapshot(state: CalendarSnapshot): CalendarSnapshot {
  const db = loadLocalDb()
  if (!db) return state
  saveLocalDb({
    ...db,
    calendars: state.calendars,
    events: state.events,
    exceptions: state.exceptions,
    taskRuns: state.taskRuns,
  })
  return state
}

function upsertException(
  exceptions: EventException[],
  exception: EventException,
): EventException[] {
  const filtered = exceptions.filter(
    (ex) =>
      !(
        ex.event_id === exception.event_id &&
        ex.original_starts_at === exception.original_starts_at
      ),
  )
  return [...filtered, exception]
}

function eventPayloadFromDraft(draft: EventDraft, now: string) {
  return {
    calendar_id: draft.calendar_id,
    title: draft.title,
    description: draft.description,
    starts_at: draft.starts_at,
    ends_at: draft.ends_at,
    all_day: draft.all_day,
    reminder_minutes: draft.reminder_minutes,
    rrule: draft.rrule,
    kind: draft.kind,
    updated_at: now,
  }
}

export function createLocalCalendarRepository(): CalendarRepository {
  return {
    async load() {
      return readSnapshot()
    },

    async toggleCalendarVisible(state, id) {
      const calendar = state.calendars.find((c) => c.id === id)
      if (!calendar) return state
      return writeSnapshot({
        ...state,
        calendars: state.calendars.map((c) =>
          c.id === id ? { ...c, visible: !c.visible } : c,
        ),
      })
    },

    async setDefaultCalendar(state, id) {
      return writeSnapshot({
        ...state,
        calendars: state.calendars.map((c) => ({ ...c, is_default: c.id === id })),
      })
    },

    async createCalendar(state, userId, name, color) {
      const calendar: Calendar = {
        id: createId(),
        user_id: userId,
        name: sanitizeCalendarName(name),
        color: sanitizeColor(color),
        is_default: false,
        visible: true,
        created_at: new Date().toISOString(),
      }
      return writeSnapshot({
        ...state,
        calendars: [...state.calendars, calendar],
      })
    },

    async saveEvent(state, userId, draft: EventDraft) {
      draft = sanitizeEventDraft(draft)
      const now = new Date().toISOString()

      if (draft.id && draft.editScope === 'single' && draft.occurrenceOriginalStartsAt) {
        const exception: EventException = {
          id: createId(),
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
          created_at: now,
        }
        return writeSnapshot({
          ...state,
          exceptions: upsertException(state.exceptions, exception),
        })
      }

      const payload = eventPayloadFromDraft(draft, now)

      if (draft.id) {
        return writeSnapshot({
          ...state,
          events: state.events.map((e) => {
            if (e.id !== draft.id) return e
            const kindChanged = e.kind !== draft.kind
            return {
              ...e,
              ...payload,
              task_status:
                draft.kind === 'task'
                  ? kindChanged
                    ? 'pending'
                    : (e.task_status ?? 'pending')
                  : null,
              task_started_at: draft.kind === 'task' ? e.task_started_at : null,
              task_completed_at: draft.kind === 'task' ? e.task_completed_at : null,
              task_duration_ms: draft.kind === 'task' ? e.task_duration_ms : null,
              task_note: draft.kind === 'task' ? e.task_note : null,
            }
          }),
        })
      }

      const event: CalendarEvent = {
        id: createId(),
        user_id: userId,
        created_at: now,
        task_status: draft.kind === 'task' ? 'pending' : null,
        task_started_at: null,
        task_completed_at: null,
        task_duration_ms: null,
        task_note: null,
        ...payload,
      }
      return writeSnapshot({
        ...state,
        events: [...state.events, event],
      })
    },

    async deleteEvent(state, userId, eventId, scope, originalStartsAt) {
      if (scope === 'single' && originalStartsAt) {
        const exception: EventException = {
          id: createId(),
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
          created_at: new Date().toISOString(),
        }
        return writeSnapshot({
          ...state,
          exceptions: upsertException(state.exceptions, exception),
        })
      }

      return writeSnapshot({
        ...state,
        events: state.events.filter((e) => e.id !== eventId),
        exceptions: state.exceptions.filter((ex) => ex.event_id !== eventId),
        taskRuns: state.taskRuns.filter((r) => r.event_id !== eventId),
      })
    },

    async startTask(state, _userId, eventId) {
      const event = state.events.find((e) => e.id === eventId)
      if (!event || event.kind !== 'task') return state
      if (event.task_status === 'in_progress') return state
      const now = new Date().toISOString()
      return writeSnapshot({
        ...state,
        events: state.events.map((e) =>
          e.id === eventId
            ? {
                ...e,
                task_status: 'in_progress',
                task_started_at: now,
                task_completed_at: null,
                task_duration_ms: null,
                updated_at: now,
              }
            : e,
        ),
      })
    },

    async completeTask(state, userId, eventId, note = '') {
      const event = state.events.find((e) => e.id === eventId)
      if (!event || event.kind !== 'task') return state
      const nowIso = new Date().toISOString()
      const startedAt = event.task_started_at ? new Date(event.task_started_at) : new Date()
      const completedAt = new Date()
      const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime())
      const cleanNote = sanitizeTaskNote(note)

      const run: TaskRun = {
        id: createId(),
        event_id: eventId,
        user_id: userId,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        duration_ms: durationMs,
        note: cleanNote,
        created_at: nowIso,
      }

      return writeSnapshot({
        ...state,
        events: state.events.map((e) =>
          e.id === eventId
            ? {
                ...e,
                task_status: 'done',
                task_started_at: startedAt.toISOString(),
                task_completed_at: completedAt.toISOString(),
                task_duration_ms: durationMs,
                task_note: cleanNote || e.task_note,
                updated_at: nowIso,
              }
            : e,
        ),
        taskRuns: [run, ...state.taskRuns],
      })
    },
  }
}
