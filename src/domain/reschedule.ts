import type { EventKind } from '../types'
import { reminderFireKey } from './reminders'

const REAGENDADO_PREFIX = 'REAGENDADO · '

/** Anticipo máximo que se conserva al posponer (el formulario llega hasta 60). */
const MAX_REMINDER_LEAD_MINUTES = 24 * 60

export function reminderLeadMinutes(value: unknown): number {
  const minutes = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  return Math.min(Math.floor(minutes), MAX_REMINDER_LEAD_MINUTES)
}

/**
 * El próximo aviso queda `delayMinutes` después de `actedAt`
 * (cuando la persona ve la notificación y elige posponer).
 * El inicio conserva el anticipo, así el aviso no queda otra vez en el pasado.
 */
export function postponedStart(actedAt: Date, delayMinutes: number, reminderMinutes = 0): Date {
  if (Number.isNaN(actedAt.getTime()) || !Number.isFinite(delayMinutes)) return new Date(NaN)
  const delay = Math.max(0, delayMinutes)
  const lead = reminderLeadMinutes(reminderMinutes)
  return new Date(actedAt.getTime() + (delay + lead) * 60 * 1000)
}

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
