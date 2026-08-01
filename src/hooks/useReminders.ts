import { useEffect, useRef } from 'react'
import { addMinutes, format } from 'date-fns'
import { expandOccurrences } from '../domain/recurrence'
import { openReminderWindow } from '../lib/tauri'
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

export function useReminders(): void {
  const { user } = useAuth()
  const { events, calendars, exceptions } = useCalendarData()
  const firedRef = useRef<Set<string>>(loadFired())

  useEffect(() => {
    if (!user) return

    const tick = async () => {
      firedRef.current = loadFired()
      const now = new Date()
      const horizon = addMinutes(now, 24 * 60)
      const occurrences = expandOccurrences(events, calendars, exceptions, now, horizon)

      for (const occ of occurrences) {
        if (snoozeActive(occ.eventId)) continue

        const remindAt = addMinutes(occ.startsAt, -occ.reminderMinutes)
        if (remindAt > now) continue
        if (occ.startsAt < addMinutes(now, -5)) continue

        const key = `${occ.eventId}:${occ.originalStartsAt.toISOString()}`
        if (firedRef.current.has(key)) continue

        firedRef.current.add(key)
        saveFired(firedRef.current)

        const calendar = calendars.find((c) => c.id === occ.calendarId)
        await openReminderWindow({
          title: occ.title,
          timeLabel: `${format(occ.startsAt, 'HH:mm')} - ${format(occ.endsAt, 'HH:mm')}`,
          calendarName: calendar?.name ?? 'Calendario',
          description: occ.description,
          eventId: occ.eventId,
        })
      }
    }

    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 15000)

    return () => window.clearInterval(id)
  }, [user, events, calendars, exceptions])
}
