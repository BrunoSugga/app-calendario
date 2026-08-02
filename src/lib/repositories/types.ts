import type {
  Calendar,
  CalendarEvent,
  EventDraft,
  EventException,
  TaskRun,
} from '../../types'

export type CalendarSnapshot = {
  calendars: Calendar[]
  events: CalendarEvent[]
  exceptions: EventException[]
  taskRuns: TaskRun[]
}

export type CalendarRepository = {
  load: () => Promise<CalendarSnapshot>
  toggleCalendarVisible: (state: CalendarSnapshot, id: string) => Promise<CalendarSnapshot>
  setDefaultCalendar: (
    state: CalendarSnapshot,
    id: string,
    userId: string,
  ) => Promise<CalendarSnapshot>
  createCalendar: (
    state: CalendarSnapshot,
    userId: string,
    name: string,
    color: string,
  ) => Promise<CalendarSnapshot>
  saveEvent: (
    state: CalendarSnapshot,
    userId: string,
    draft: EventDraft,
  ) => Promise<CalendarSnapshot>
  deleteEvent: (
    state: CalendarSnapshot,
    userId: string,
    eventId: string,
    scope: 'single' | 'series',
    originalStartsAt?: string,
  ) => Promise<CalendarSnapshot>
  startTask: (state: CalendarSnapshot, userId: string, eventId: string) => Promise<CalendarSnapshot>
  completeTask: (
    state: CalendarSnapshot,
    userId: string,
    eventId: string,
    note?: string,
  ) => Promise<CalendarSnapshot>
  /** Optional realtime subscription; returns unsubscribe */
  subscribe?: (onChange: () => void) => () => void
}

export const emptySnapshot = (): CalendarSnapshot => ({
  calendars: [],
  events: [],
  exceptions: [],
  taskRuns: [],
})
