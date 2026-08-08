import { useEffect, useRef } from 'react'
import { format, formatISO } from 'date-fns'
import { expandOccurrences } from '../domain/recurrence'
import {
  reminderFireKey,
  reminderScanRangeWithWorkWeek,
  selectDueReminders,
} from '../domain/reminders'
import {
  consumeQueuedOpenEvent,
  consumeQueuedRescheduleEvent,
  consumeQueuedStartTask,
  isTauri,
  openReminderWindow,
  type RescheduleEventPayload,
} from '../lib/tauri'
import { isSafeId, isSafeIsoDate } from '../lib/security'
import { useCalendarData } from '../context/CalendarDataContext'
import { useAuth } from '../context/AuthContext'

const FIRED_KEY = 'calendario.reminders.fired'

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

function snoozeActive(eventId: string): boolean {
  const until = Number(localStorage.getItem(`calendario.snooze.${eventId}`) ?? '0')
  return until > Date.now()
}

type Options = {
  onOpenInCalendar?: (payload: { eventId: string; startsAt: string }) => void
  onStartTask?: (eventId: string) => void
  onReschedule?: (payload: RescheduleEventPayload) => void
}

export function useReminders(options: Options = {}): void {
  const { user } = useAuth()
  const { events, calendars, exceptions, workWeek } = useCalendarData()
  const firedRef = useRef<Set<string>>(loadFired())
  const optionsRef = useRef(options)
  optionsRef.current = options

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
    if (!user) return

    const tick = async () => {
      firedRef.current = loadFired()
      const now = new Date()
      const range = reminderScanRangeWithWorkWeek(now, workWeek)
      const occurrences = expandOccurrences(
        events,
        calendars,
        exceptions,
        range.start,
        range.end,
      )
      const due = selectDueReminders(occurrences, now, firedRef.current, {
        snoozeActive,
        workWeek,
      })

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
        if (!opened) continue
        firedRef.current.add(key)
        saveFired(firedRef.current)
      }
    }

    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 15000)

    return () => window.clearInterval(id)
  }, [user, events, calendars, exceptions, workWeek])
}
