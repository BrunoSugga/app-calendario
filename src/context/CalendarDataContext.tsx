import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Calendar, CalendarEvent, EventDraft, EventException, TaskRun } from '../types'
import { DEFAULT_WORK_WEEK, type WorkWeekSettings } from '../domain/workWeek'
import { useAuth } from './AuthContext'
import {
  createCalendarRepository,
  emptySnapshot,
  type CalendarRepository,
  type CalendarSnapshot,
} from '../lib/repositories'
import {
  createWorkWeekSettingsRepository,
  type WorkWeekSettingsRepository,
} from '../lib/repositories/workWeekSettings'
import {
  applyDevicePrefs,
  pruneDevicePrefsAfterDelete,
  resolveDevicePrefs,
  saveDevicePrefs,
  setDefaultInPrefs,
  toggleHiddenInPrefs,
} from '../lib/deviceCalendarPrefs'
import type { CalendarBackup } from '../lib/calendarBackup'
import { parseCalendarBackup, remapBackupForImport } from '../lib/calendarBackup'

type CalendarDataContextValue = {
  calendars: Calendar[]
  events: CalendarEvent[]
  exceptions: EventException[]
  taskRuns: TaskRun[]
  workWeek: WorkWeekSettings
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  toggleCalendarVisible: (id: string) => Promise<void>
  setDefaultCalendar: (id: string) => Promise<void>
  createCalendar: (name: string, color: string) => Promise<void>
  updateCalendar: (id: string, patch: { name?: string; color?: string }) => Promise<void>
  deleteCalendar: (id: string, options?: { moveToCalendarId?: string }) => Promise<void>
  importCalendarBackup: (backup: CalendarBackup) => Promise<void>
  saveEvent: (draft: EventDraft) => Promise<void>
  deleteEvent: (eventId: string, scope: 'single' | 'series', originalStartsAt?: string) => Promise<void>
  startTask: (eventId: string) => Promise<void>
  completeTask: (eventId: string, note?: string) => Promise<void>
  saveWorkWeek: (settings: WorkWeekSettings) => Promise<void>
}

const CalendarDataContext = createContext<CalendarDataContextValue | null>(null)

function applySnapshot(
  snapshot: CalendarSnapshot,
  setCalendars: (v: Calendar[]) => void,
  setEvents: (v: CalendarEvent[]) => void,
  setExceptions: (v: EventException[]) => void,
  setTaskRuns: (v: TaskRun[]) => void,
  userId: string | undefined,
) {
  if (userId) {
    const prefs = resolveDevicePrefs(userId, snapshot.calendars)
    setCalendars(applyDevicePrefs(snapshot.calendars, prefs))
  } else {
    setCalendars(snapshot.calendars)
  }
  setEvents(snapshot.events)
  setExceptions(snapshot.exceptions)
  setTaskRuns(snapshot.taskRuns)
}

export function CalendarDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [exceptions, setExceptions] = useState<EventException[]>([])
  const [taskRuns, setTaskRuns] = useState<TaskRun[]>([])
  const [workWeek, setWorkWeek] = useState<WorkWeekSettings>({ ...DEFAULT_WORK_WEEK })
  // true hasta el primer refresh: evita que useReminders avance lastScan con events=[]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const repo: CalendarRepository = useMemo(() => createCalendarRepository(), [])
  const workWeekRepo: WorkWeekSettingsRepository = useMemo(
    () => createWorkWeekSettingsRepository(),
    [],
  )

  const refresh = useCallback(async () => {
    if (!user) {
      applySnapshot(emptySnapshot(), setCalendars, setEvents, setExceptions, setTaskRuns, undefined)
      setWorkWeek({ ...DEFAULT_WORK_WEEK })
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [next, nextWorkWeek] = await Promise.all([repo.load(), workWeekRepo.load()])
      applySnapshot(next, setCalendars, setEvents, setExceptions, setTaskRuns, user.id)
      // Si el calendario laboral ya no existe, no lo referenciamos en UI
      if (
        nextWorkWeek.workCalendarId &&
        !next.calendars.some((c) => c.id === nextWorkWeek.workCalendarId)
      ) {
        setWorkWeek({ ...nextWorkWeek, workCalendarId: null })
      } else {
        setWorkWeek(nextWorkWeek)
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Error al cargar datos'
      const needsMigration =
        /task_runs|work_week_settings|column .*kind|schema cache|does not exist/i.test(message)
      setError(
        needsMigration
          ? `${message}. Ejecutá en Supabase las migraciones pendientes (p. ej. 003 / 007) y recargá.`
          : message || 'Error al cargar datos',
      )
    } finally {
      setLoading(false)
    }
  }, [user, repo, workWeekRepo])

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
      // Pasar snapshot sin overlay de prefs: los campos is_default/visible en estado
      // ya están mergeados; las mutaciones de calendarios (nombre/borrar) no dependen de ellos.
      const next = await mutate({
        calendars,
        events,
        exceptions,
        taskRuns,
      })
      applySnapshot(next, setCalendars, setEvents, setExceptions, setTaskRuns, user.id)
    },
    [user, calendars, events, exceptions, taskRuns],
  )

  const toggleCalendarVisible = useCallback(
    async (id: string) => {
      if (!user) return
      const prefs = resolveDevicePrefs(user.id, calendars)
      const nextPrefs = toggleHiddenInPrefs(prefs, id)
      saveDevicePrefs(user.id, nextPrefs)
      setCalendars(applyDevicePrefs(calendars, nextPrefs))
    },
    [user, calendars],
  )

  const setDefaultCalendar = useCallback(
    async (id: string) => {
      if (!user) return
      const prefs = resolveDevicePrefs(user.id, calendars)
      const nextPrefs = setDefaultInPrefs(prefs, id)
      saveDevicePrefs(user.id, nextPrefs)
      setCalendars(applyDevicePrefs(calendars, nextPrefs))
    },
    [user, calendars],
  )

  const createCalendar = useCallback(
    async (name: string, color: string) => {
      if (!user) return
      await runMutation((state) => repo.createCalendar(state, user.id, name, color))
    },
    [repo, runMutation, user],
  )

  const updateCalendar = useCallback(
    async (id: string, patch: { name?: string; color?: string }) => {
      if (!user) return
      await runMutation((state) => repo.updateCalendar(state, id, patch))
    },
    [repo, runMutation, user],
  )

  const deleteCalendar = useCallback(
    async (id: string, options?: { moveToCalendarId?: string }) => {
      if (!user) return
      const prefsBefore = resolveDevicePrefs(user.id, calendars)
      const remainingIds = calendars.filter((c) => c.id !== id).map((c) => c.id)
      saveDevicePrefs(user.id, pruneDevicePrefsAfterDelete(prefsBefore, id, remainingIds))

      if (workWeek.workCalendarId === id) {
        const nextWw = { ...workWeek, workCalendarId: null }
        setWorkWeek(nextWw)
        try {
          await workWeekRepo.save(nextWw)
        } catch {
          /* refresh posterior corrige */
        }
      }

      await runMutation((state) => repo.deleteCalendar(state, id, user.id, options))
    },
    [user, calendars, repo, runMutation, workWeek, workWeekRepo],
  )

  const importCalendarBackupFn = useCallback(
    async (backup: CalendarBackup) => {
      if (!user) return
      const parsed = parseCalendarBackup(backup, user.id)
      const payload = remapBackupForImport(parsed, user.id)
      await runMutation((state) => repo.importCalendarBackup(state, user.id, payload))
    },
    [user, repo, runMutation],
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

  const startTask = useCallback(
    async (eventId: string) => {
      if (!user) return
      await runMutation((state) => repo.startTask(state, user.id, eventId))
    },
    [repo, runMutation, user],
  )

  const completeTask = useCallback(
    async (eventId: string, note?: string) => {
      if (!user) return
      await runMutation((state) => repo.completeTask(state, user.id, eventId, note))
    },
    [repo, runMutation, user],
  )

  const saveWorkWeek = useCallback(
    async (settings: WorkWeekSettings) => {
      if (!user) return
      const next = await workWeekRepo.save(settings)
      setWorkWeek(next)
    },
    [user, workWeekRepo],
  )

  const value = useMemo(
    () => ({
      calendars,
      events,
      exceptions,
      taskRuns,
      workWeek,
      loading,
      error,
      refresh,
      toggleCalendarVisible,
      setDefaultCalendar,
      createCalendar,
      updateCalendar,
      deleteCalendar,
      importCalendarBackup: importCalendarBackupFn,
      saveEvent,
      deleteEvent,
      startTask,
      completeTask,
      saveWorkWeek,
    }),
    [
      calendars,
      events,
      exceptions,
      taskRuns,
      workWeek,
      loading,
      error,
      refresh,
      toggleCalendarVisible,
      setDefaultCalendar,
      createCalendar,
      updateCalendar,
      deleteCalendar,
      importCalendarBackupFn,
      saveEvent,
      deleteEvent,
      startTask,
      completeTask,
      saveWorkWeek,
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
