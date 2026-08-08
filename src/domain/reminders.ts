import { addMinutes } from 'date-fns'
import type { Occurrence } from '../types'

export const REMINDER_GRACE_MINUTES = 5
export const REMINDER_HORIZON_HOURS = 24

export function reminderScanRange(
  now: Date,
  graceMinutes = REMINDER_GRACE_MINUTES,
  horizonHours = REMINDER_HORIZON_HOURS,
): { start: Date; end: Date } {
  return {
    // Incluye eventos/recordatorios que ya empezaron dentro de la gracia
    // (crítico para kind=reminder con ends_at === starts_at).
    start: addMinutes(now, -graceMinutes),
    end: addMinutes(now, horizonHours * 60),
  }
}

export function reminderFireKey(eventId: string, originalStartsAt: Date): string {
  return `${eventId}:${originalStartsAt.toISOString()}`
}

export function isOccurrenceDueForReminder(
  occ: Pick<Occurrence, 'eventId' | 'startsAt' | 'reminderMinutes'>,
  now: Date,
  options?: {
    graceMinutes?: number
    snoozeActive?: (eventId: string) => boolean
  },
): boolean {
  const graceMinutes = options?.graceMinutes ?? REMINDER_GRACE_MINUTES
  if (options?.snoozeActive?.(occ.eventId)) return false

  const remindAt = addMinutes(occ.startsAt, -occ.reminderMinutes)
  if (remindAt > now) return false
  if (occ.startsAt < addMinutes(now, -graceMinutes)) return false
  return true
}

export function selectDueReminders(
  occurrences: Occurrence[],
  now: Date,
  fired: ReadonlySet<string>,
  options?: {
    graceMinutes?: number
    snoozeActive?: (eventId: string) => boolean
  },
): Occurrence[] {
  const due: Occurrence[] = []
  for (const occ of occurrences) {
    if (!isOccurrenceDueForReminder(occ, now, options)) continue
    const key = reminderFireKey(occ.eventId, occ.originalStartsAt)
    if (fired.has(key)) continue
    due.push(occ)
  }
  return due
}
