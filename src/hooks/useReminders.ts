import { useEffect, useRef, useState } from 'react'
import { format, formatISO } from 'date-fns'
import { expandOccurrences } from '../domain/recurrence'
import {
  partitionMissedReminders,
  reminderFireKey,
  reminderScanRangeWithWorkWeek,
  reminderSnoozeLookback,
  shouldCommitReminderLastScan,
} from '../domain/reminders'
import {
  consumeQueuedOpenEvent,
  consumeQueuedRescheduleEvent,
  consumeQueuedStartTask,
  isTauri,
  openReminderWindow,
  type RescheduleEventPayload,
} from '../lib/tauri'
import { isCapacitor } from '../lib/platform'
import { isSafeId, isSafeIsoDate } from '../lib/security'
import { NATIVE_REMINDER_HORIZON_HOURS } from '../lib/nativeReminders'
import { useCalendarData } from '../context/CalendarDataContext'
import { useAuth } from '../context/AuthContext'
import type { EventKind, Occurrence } from '../types'

const FIRED_KEY = 'calendario.reminders.fired'
const LAST_SCAN_KEY = 'calendario.reminders.lastScan'

export type MissedReminderRow = {
  eventId: string
  originalStartsAt: string
  startsAt: string
  title: string
  calendarName: string
  kind: EventKind
  fireKey: string
}

function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveFired(set: Set<string>): void {
  const values = [...set].slice(-500)
  localStorage.setItem(FIRED_KEY, JSON.stringify(values))
}

function loadLastScan(): Date | null {
  try {
    const raw = localStorage.getItem(LAST_SCAN_KEY)
    if (!raw) return null
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

function saveLastScan(now: Date): void {
  localStorage.setItem(LAST_SCAN_KEY, now.toISOString())
}

function snoozeUntil(eventId: string): number | null {
  const until = Number(localStorage.getItem(`calendario.snooze.${eventId}`) ?? '0')
  return Number.isFinite(until) && until > 0 ? until : null
}

function snoozeActive(eventId: string): boolean {
  return (snoozeUntil(eventId) ?? 0) > Date.now()
}

function toMissedRow(occ: Occurrence, calendarName: string): MissedReminderRow {
  return {
    eventId: occ.eventId,
    originalStartsAt: formatISO(occ.originalStartsAt),
    startsAt: formatISO(occ.startsAt),
    title: occ.title,
    calendarName,
    kind: occ.kind,
    fireKey: reminderFireKey(occ.eventId, occ.originalStartsAt),
  }
}

type Options = {
  onOpenInCalendar?: (payload: { eventId: string; startsAt: string }) => void
  onStartTask?: (eventId: string) => void
  onReschedule?: (payload: RescheduleEventPayload) => void
}

export function useReminders(options: Options = {}): {
  missedReminders: MissedReminderRow[] | null
  dismissMissedReminders: () => void
} {
  const { user } = useAuth()
  const { events, calendars, exceptions, workWeek, loading } = useCalendarData()
  const firedRef = useRef<Set<string>>(loadFired())
  const optionsRef = useRef(options)
  optionsRef.current = options
  const [missedReminders, setMissedReminders] = useState<MissedReminderRow[] | null>(null)
  const missedOpenRef = useRef(false)

  function dismissMissedReminders() {
    setMissedReminders((current) => {
      if (current && current.length > 0) {
        firedRef.current = loadFired()
        for (const row of current) {
          firedRef.current.add(row.fireKey)
        }
        saveFired(firedRef.current)
      }
      return null
    })
    missedOpenRef.current = false
    saveLastScan(new Date())
  }

  useEffect(() => {
    function handleOpen(payload: { eventId: string; startsAt: string }) {
      if (!isSafeId(payload.eventId) || !isSafeIsoDate(payload.startsAt)) return
      optionsRef.current.onOpenInCalendar?.(payload)
    }
    function handleStart(eventId: string) {
      if (!isSafeId(eventId)) return
      optionsRef.current.onStartTask?.(eventId)
    }
    function handleReschedule(payload: RescheduleEventPayload) {
      if (
        !isSafeId(payload.eventId) ||
        !isSafeIsoDate(payload.originalStartsAt) ||
        !isSafeIsoDate(payload.newStartsAt)
      ) {
        return
      }
      optionsRef.current.onReschedule?.(payload)
    }

    function onDomOpen(ev: Event) {
      const detail = (ev as CustomEvent<{ eventId: string; startsAt: string }>).detail
      if (detail?.eventId && detail?.startsAt) handleOpen(detail)
    }
    function onDomStart(ev: Event) {
      const detail = (ev as CustomEvent<{ eventId: string }>).detail
      if (detail?.eventId) handleStart(detail.eventId)
    }
    function onDomReschedule(ev: Event) {
      const detail = (ev as CustomEvent<RescheduleEventPayload>).detail
      if (detail?.eventId && detail?.originalStartsAt && detail?.newStartsAt) {
        handleReschedule(detail)
      }
    }

    window.addEventListener('calendario:open-event', onDomOpen)
    window.addEventListener('calendario:start-task', onDomStart)
    window.addEventListener('calendario:reschedule-event', onDomReschedule)

    let unlistenOpen: (() => void) | undefined
    let unlistenStart: (() => void) | undefined
    let unlistenReschedule: (() => void) | undefined
    let cancelled = false

    if (isTauri()) {
      void (async () => {
        const { listen } = await import('@tauri-apps/api/event')
        if (cancelled) return
        unlistenOpen = await listen<{ eventId: string; startsAt: string }>(
          'calendario:open-event',
          (event) => handleOpen(event.payload),
        )
        unlistenStart = await listen<{ eventId: string }>(
          'calendario:start-task',
          (event) => handleStart(event.payload.eventId),
        )
        unlistenReschedule = await listen<RescheduleEventPayload>(
          'calendario:reschedule-event',
          (event) => handleReschedule(event.payload),
        )
      })()
    }

    const pollPending = () => {
      const open = consumeQueuedOpenEvent()
      if (open) handleOpen(open)
      const startId = consumeQueuedStartTask()
      if (startId) handleStart(startId)
      const reschedule = consumeQueuedRescheduleEvent()
      if (reschedule) handleReschedule(reschedule)
    }
    pollPending()
    const pendingId = window.setInterval(pollPending, 2000)

    return () => {
      cancelled = true
      window.removeEventListener('calendario:open-event', onDomOpen)
      window.removeEventListener('calendario:start-task', onDomStart)
      window.removeEventListener('calendario:reschedule-event', onDomReschedule)
      window.clearInterval(pendingId)
      unlistenOpen?.()
      unlistenStart?.()
      unlistenReschedule?.()
    }
  }, [])

  useEffect(() => {
    // Cruciale: no escanear ni avanzar lastScan hasta tener el snapshot cargado.
    // Si no, al abrir la app el primer tick corre con events=[] y “quema” el catch-up.
    if (!user || loading) return

    const tick = async () => {
      firedRef.current = loadFired()
      const now = new Date()
      const lastScan = loadLastScan()
      const snoozeLookback = reminderSnoozeLookback(
        events.map((event) => snoozeUntil(event.id)),
        now,
      )
      const scanFrom =
        snoozeLookback && (!lastScan || snoozeLookback.getTime() < lastScan.getTime())
          ? snoozeLookback
          : lastScan
      const range = reminderScanRangeWithWorkWeek(now, workWeek, undefined, undefined, scanFrom)
      const occurrences = expandOccurrences(
        events,
        calendars,
        exceptions,
        range.start,
        range.end,
      )
      const { due, ancient } = partitionMissedReminders(occurrences, now, firedRef.current, {
        snoozeActive,
        snoozeUntil,
        workWeek,
        lastScan,
      })

      let openFailures = 0
      for (const occ of due) {
        const key = reminderFireKey(occ.eventId, occ.originalStartsAt)

        const calendar = calendars.find((c) => c.id === occ.calendarId)
        const timeLabel =
          occ.kind === 'reminder'
            ? format(occ.startsAt, 'HH:mm')
            : `${format(occ.startsAt, 'HH:mm')} - ${format(occ.endsAt, 'HH:mm')}`

        const opened = await openReminderWindow({
          title: occ.title,
          timeLabel,
          calendarName: calendar?.name ?? 'Calendario',
          description: occ.description,
          eventId: occ.eventId,
          kind: occ.kind,
          startsAt: formatISO(occ.startsAt),
          originalStartsAt: formatISO(occ.originalStartsAt),
        })

        // Solo marcar disparado si se mostró aviso (popup/alert/webview).
        if (!opened) {
          openFailures += 1
          continue
        }
        firedRef.current.add(key)
        saveFired(firedRef.current)
        localStorage.removeItem(`calendario.snooze.${occ.eventId}`)
      }

      if (ancient.length > 0 && !missedOpenRef.current) {
        missedOpenRef.current = true
        setMissedReminders(
          ancient.map((occ) => {
            const calendar = calendars.find((c) => c.id === occ.calendarId)
            return toMissedRow(occ, calendar?.name ?? 'Calendario')
          }),
        )
      }

      if (
        shouldCommitReminderLastScan({
          dataReady: true,
          missedModalPending: missedOpenRef.current,
          openFailures,
        })
      ) {
        saveLastScan(now)
      }
    }

    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 15000)

    return () => window.clearInterval(id)
  }, [user, loading, events, calendars, exceptions, workWeek])

  useEffect(() => {
    if (!isCapacitor()) return
    let cancelled = false
    let stop: (() => void) | undefined
    void (async () => {
      const { listenNativeReminderActions, requestNativeReminderPermissions } = await import(
        '../lib/nativeRemindersBridge'
      )
      if (cancelled) return
      await requestNativeReminderPermissions()
      if (cancelled) return
      stop = await listenNativeReminderActions()
    })()
    return () => {
      cancelled = true
      stop?.()
    }
  }, [])

  useEffect(() => {
    if (!isCapacitor() || !user || loading) return
    const now = new Date()
    const rangeEnd = new Date(now.getTime() + NATIVE_REMINDER_HORIZON_HOURS * 60 * 60 * 1000)
    const upcoming = expandOccurrences(events, calendars, exceptions, now, rangeEnd)
    void import('../lib/nativeRemindersBridge').then(({ syncNativeReminderSchedule }) =>
      syncNativeReminderSchedule(upcoming, {
        now,
        calendars,
        workWeek,
        fired: loadFired(),
        snoozeActive,
      }),
    )
  }, [user, loading, events, calendars, exceptions, workWeek])

  return { missedReminders, dismissMissedReminders }
}
