import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Calendar, CalendarEvent, EventDraft, EventException } from '../types'
import { useAuth } from './AuthContext'
import {
  createCalendarRepository,
  emptySnapshot,
  type CalendarRepository,
  type CalendarSnapshot,
} from '../lib/repositories'

type CalendarDataContextValue = {
  calendars: Calendar[]
  events: CalendarEvent[]
  exceptions: EventException[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  toggleCalendarVisible: (id: string) => Promise<void>
  setDefaultCalendar: (id: string) => Promise<void>
  createCalendar: (name: string, color: string) => Promise<void>
  saveEvent: (draft: EventDraft) => Promise<void>
  deleteEvent: (eventId: string, scope: 'single' | 'series', originalStartsAt?: string) => Promise<void>
}

const CalendarDataContext = createContext<CalendarDataContextValue | null>(null)

function applySnapshot(
  snapshot: CalendarSnapshot,
  setCalendars: (v: Calendar[]) => void,
  setEvents: (v: CalendarEvent[]) => void,
  setExceptions: (v: EventException[]) => void,
) {
  setCalendars(snapshot.calendars)
  setEvents(snapshot.events)
  setExceptions(snapshot.exceptions)
}

export function CalendarDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [exceptions, setExceptions] = useState<EventException[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const repo: CalendarRepository = useMemo(() => createCalendarRepository(), [])

  const snapshot = useMemo(
    (): CalendarSnapshot => ({ calendars, events, exceptions }),
    [calendars, events, exceptions],
  )

  const refresh = useCallback(async () => {
    if (!user) {
      applySnapshot(emptySnapshot(), setCalendars, setEvents, setExceptions)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const next = await repo.load()
      applySnapshot(next, setCalendars, setEvents, setExceptions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [user, repo])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user || !repo.subscribe) return
    return repo.subscribe(() => {
      void refresh()
    })
  }, [user, repo, refresh])

  const runMutation = useCallback(
    async (mutate: (state: CalendarSnapshot) => Promise<CalendarSnapshot>) => {
      if (!user) return
      const next = await mutate(snapshot)
      applySnapshot(next, setCalendars, setEvents, setExceptions)
    },
    [user, snapshot],
  )

  const toggleCalendarVisible = useCallback(
    async (id: string) => {
      await runMutation((state) => repo.toggleCalendarVisible(state, id))
    },
    [repo, runMutation],
  )

  const setDefaultCalendar = useCallback(
    async (id: string) => {
      if (!user) return
      await runMutation((state) => repo.setDefaultCalendar(state, id, user.id))
    },
    [repo, runMutation, user],
  )

  const createCalendar = useCallback(
    async (name: string, color: string) => {
      if (!user) return
      await runMutation((state) => repo.createCalendar(state, user.id, name, color))
    },
    [repo, runMutation, user],
  )

  const saveEvent = useCallback(
    async (draft: EventDraft) => {
      if (!user) return
      await runMutation((state) => repo.saveEvent(state, user.id, draft))
    },
    [repo, runMutation, user],
  )

  const deleteEvent = useCallback(
    async (eventId: string, scope: 'single' | 'series', originalStartsAt?: string) => {
      if (!user) return
      await runMutation((state) =>
        repo.deleteEvent(state, user.id, eventId, scope, originalStartsAt),
      )
    },
    [repo, runMutation, user],
  )

  const value = useMemo(
    () => ({
      calendars,
      events,
      exceptions,
      loading,
      error,
      refresh,
      toggleCalendarVisible,
      setDefaultCalendar,
      createCalendar,
      saveEvent,
      deleteEvent,
    }),
    [
      calendars,
      events,
      exceptions,
      loading,
      error,
      refresh,
      toggleCalendarVisible,
      setDefaultCalendar,
      createCalendar,
      saveEvent,
      deleteEvent,
    ],
  )

  return (
    <CalendarDataContext.Provider value={value}>{children}</CalendarDataContext.Provider>
  )
}

export function useCalendarData(): CalendarDataContextValue {
  const ctx = useContext(CalendarDataContext)
  if (!ctx) throw new Error('useCalendarData debe usarse dentro de CalendarDataProvider')
  return ctx
}
