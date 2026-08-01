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
import { isCloudMode, supabase } from '../lib/supabase'
import { createId } from '../lib/id'
import { loadLocalDb, saveLocalDb } from '../lib/localStore'

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

export function CalendarDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [exceptions, setExceptions] = useState<EventException[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setCalendars([])
      setEvents([])
      setExceptions([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (isCloudMode && supabase) {
        const [cRes, eRes, xRes] = await Promise.all([
          supabase.from('calendars').select('*').order('created_at'),
          supabase.from('events').select('*').order('starts_at'),
          supabase.from('event_exceptions').select('*'),
        ])
        if (cRes.error) throw cRes.error
        if (eRes.error) throw eRes.error
        if (xRes.error) throw xRes.error
        setCalendars((cRes.data ?? []) as Calendar[])
        setEvents((eRes.data ?? []) as CalendarEvent[])
        setExceptions((xRes.data ?? []) as EventException[])
      } else {
        const db = loadLocalDb()
        if (!db) return
        setCalendars(db.calendars)
        setEvents(db.events)
        setExceptions(db.exceptions)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user || !isCloudMode || !supabase) return

    const channel = supabase
      .channel('calendar-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendars' }, () => {
        void refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        void refresh()
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_exceptions' },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase!.removeChannel(channel)
    }
  }, [user, refresh])

  const persistLocal = useCallback(
    (next: { calendars: Calendar[]; events: CalendarEvent[]; exceptions: EventException[] }) => {
      const db = loadLocalDb()
      if (!db || !user) return
      saveLocalDb({
        ...db,
        calendars: next.calendars,
        events: next.events,
        exceptions: next.exceptions,
      })
      setCalendars(next.calendars)
      setEvents(next.events)
      setExceptions(next.exceptions)
    },
    [user],
  )

  const toggleCalendarVisible = useCallback(
    async (id: string) => {
      const calendar = calendars.find((c) => c.id === id)
      if (!calendar) return
      const visible = !calendar.visible

      if (isCloudMode && supabase) {
        const { error: err } = await supabase.from('calendars').update({ visible }).eq('id', id)
        if (err) throw err
        await refresh()
        return
      }

      persistLocal({
        calendars: calendars.map((c) => (c.id === id ? { ...c, visible } : c)),
        events,
        exceptions,
      })
    },
    [calendars, events, exceptions, persistLocal, refresh],
  )

  const setDefaultCalendar = useCallback(
    async (id: string) => {
      if (isCloudMode && supabase && user) {
        await supabase.from('calendars').update({ is_default: false }).eq('user_id', user.id)
        const { error: err } = await supabase
          .from('calendars')
          .update({ is_default: true })
          .eq('id', id)
        if (err) throw err
        await refresh()
        return
      }

      persistLocal({
        calendars: calendars.map((c) => ({ ...c, is_default: c.id === id })),
        events,
        exceptions,
      })
    },
    [calendars, events, exceptions, persistLocal, refresh, user],
  )

  const createCalendar = useCallback(
    async (name: string, color: string) => {
      if (!user) return

      if (isCloudMode && supabase) {
        const { error: err } = await supabase.from('calendars').insert({
          user_id: user.id,
          name,
          color,
          is_default: false,
          visible: true,
        })
        if (err) throw err
        await refresh()
        return
      }

      const now = new Date().toISOString()
      const calendar: Calendar = {
        id: createId(),
        user_id: user.id,
        name,
        color,
        is_default: false,
        visible: true,
        created_at: now,
      }
      persistLocal({ calendars: [...calendars, calendar], events, exceptions })
    },
    [user, calendars, events, exceptions, persistLocal, refresh],
  )

  const saveEvent = useCallback(
    async (draft: EventDraft) => {
      if (!user) return
      const now = new Date().toISOString()

      if (draft.id && draft.editScope === 'single' && draft.occurrenceOriginalStartsAt) {
        const exception: EventException = {
          id: createId(),
          event_id: draft.id,
          user_id: user.id,
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

        if (isCloudMode && supabase) {
          const { error: err } = await supabase.from('event_exceptions').upsert(
            {
              event_id: draft.id,
              user_id: user.id,
              original_starts_at: draft.occurrenceOriginalStartsAt,
              is_cancelled: false,
              title: draft.title,
              description: draft.description,
              starts_at: draft.starts_at,
              ends_at: draft.ends_at,
              all_day: draft.all_day,
              reminder_minutes: draft.reminder_minutes,
            },
            { onConflict: 'event_id,original_starts_at' },
          )
          if (err) {
            const { error: insertErr } = await supabase.from('event_exceptions').insert({
              event_id: draft.id,
              user_id: user.id,
              original_starts_at: draft.occurrenceOriginalStartsAt,
              is_cancelled: false,
              title: draft.title,
              description: draft.description,
              starts_at: draft.starts_at,
              ends_at: draft.ends_at,
              all_day: draft.all_day,
              reminder_minutes: draft.reminder_minutes,
            })
            if (insertErr) throw insertErr
          }
          await refresh()
          return
        }

        const filtered = exceptions.filter(
          (ex) =>
            !(
              ex.event_id === draft.id &&
              ex.original_starts_at === draft.occurrenceOriginalStartsAt
            ),
        )
        persistLocal({ calendars, events, exceptions: [...filtered, exception] })
        return
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

      if (isCloudMode && supabase) {
        if (draft.id) {
          const { error: err } = await supabase.from('events').update(payload).eq('id', draft.id)
          if (err) throw err
        } else {
          const { error: err } = await supabase.from('events').insert({
            ...payload,
            user_id: user.id,
          })
          if (err) throw err
        }
        await refresh()
        return
      }

      if (draft.id) {
        persistLocal({
          calendars,
          events: events.map((e) => (e.id === draft.id ? { ...e, ...payload } : e)),
          exceptions,
        })
      } else {
        const event: CalendarEvent = {
          id: createId(),
          user_id: user.id,
          created_at: now,
          ...payload,
        }
        persistLocal({ calendars, events: [...events, event], exceptions })
      }
    },
    [user, calendars, events, exceptions, persistLocal, refresh],
  )

  const deleteEvent = useCallback(
    async (eventId: string, scope: 'single' | 'series', originalStartsAt?: string) => {
      if (!user) return

      if (scope === 'single' && originalStartsAt) {
        const now = new Date().toISOString()
        if (isCloudMode && supabase) {
          const { error: err } = await supabase.from('event_exceptions').upsert(
            {
              event_id: eventId,
              user_id: user.id,
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
          if (err) throw err
          await refresh()
          return
        }

        const exception: EventException = {
          id: createId(),
          event_id: eventId,
          user_id: user.id,
          original_starts_at: originalStartsAt,
          is_cancelled: true,
          title: null,
          description: null,
          starts_at: null,
          ends_at: null,
          all_day: null,
          reminder_minutes: null,
          created_at: now,
        }
        const filtered = exceptions.filter(
          (ex) => !(ex.event_id === eventId && ex.original_starts_at === originalStartsAt),
        )
        persistLocal({ calendars, events, exceptions: [...filtered, exception] })
        return
      }

      if (isCloudMode && supabase) {
        const { error: err } = await supabase.from('events').delete().eq('id', eventId)
        if (err) throw err
        await refresh()
        return
      }

      persistLocal({
        calendars,
        events: events.filter((e) => e.id !== eventId),
        exceptions: exceptions.filter((ex) => ex.event_id !== eventId),
      })
    },
    [user, calendars, events, exceptions, persistLocal, refresh],
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
