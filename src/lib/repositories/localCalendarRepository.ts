import type { Calendar, CalendarEvent, EventDraft, EventException } from '../../types'
import { createId } from '../id'
import { loadLocalDb, saveLocalDb } from '../localStore'
import type { CalendarRepository, CalendarSnapshot } from './types'
import { emptySnapshot } from './types'

function readSnapshot(): CalendarSnapshot {
  const db = loadLocalDb()
  if (!db) return emptySnapshot()
  return {
    calendars: db.calendars,
    events: db.events,
    exceptions: db.exceptions,
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
        name,
        color,
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

      const payload = {
        calendar_id: draft.calendar_id,
        title: draft.title,
        description: draft.description,
        starts_at: draft.starts_at,
        ends_at: draft.ends_at,
        all_day: draft.all_day,
        reminder_minutes: draft.reminder_minutes,
        rrule: draft.rrule,
        updated_at: now,
      }

      if (draft.id) {
        return writeSnapshot({
          ...state,
          events: state.events.map((e) => (e.id === draft.id ? { ...e, ...payload } : e)),
        })
      }

      const event: CalendarEvent = {
        id: createId(),
        user_id: userId,
        created_at: now,
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
      })
    },
  }
}
