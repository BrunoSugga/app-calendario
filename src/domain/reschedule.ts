import type { EventKind } from '../types'
import { reminderFireKey } from './reminders'

const REAGENDADO_PREFIX = 'REAGENDADO · '

/** Mueve el inicio y conserva la duración, así el fin se corre la misma cantidad. */
export function movedScheduleWindow(
  startsAt: Date,
  endsAt: Date,
  newStartsAt: Date,
  kind: EventKind,
): { startsAt: Date; endsAt: Date } {
  if (kind === 'reminder' || Number.isNaN(newStartsAt.getTime())) {
    return { startsAt: newStartsAt, endsAt: newStartsAt }
  }
  const durationMs = Math.max(0, endsAt.getTime() - startsAt.getTime())
  return {
    startsAt: newStartsAt,
    endsAt: new Date(newStartsAt.getTime() + durationMs),
  }
}

export function withReagendadoPrefix(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return `${REAGENDADO_PREFIX}Sin título`
  if (trimmed.toUpperCase().startsWith('REAGENDADO')) return trimmed
  return `${REAGENDADO_PREFIX}${trimmed}`
}

export function clearFiredForOccurrence(eventId: string, originalStartsAt: Date): void {
  if (Number.isNaN(originalStartsAt.getTime())) return
  const key = reminderFireKey(eventId, originalStartsAt)
  try {
    const raw = localStorage.getItem('calendario.reminders.fired')
    const list = raw ? (JSON.parse(raw) as string[]) : []
    const next = list.filter((item) => item !== key)
    localStorage.setItem('calendario.reminders.fired', JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function clearSnoozeForEvent(eventId: string): void {
  try {
    localStorage.removeItem(`calendario.snooze.${eventId}`)
  } catch {
    // ignore
  }
}
