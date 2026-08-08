import { addMinutes } from 'date-fns'
import type { Occurrence } from '../types'
import {
  isWithinWorkHours,
  isWorkCalendarMuted,
  previousWorkPeriodEnd,
  type WorkWeekSettings,
} from './workWeek'

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

/** Amplía el lookback cuando hay mute laboral para no perder avisos diferidos. */
export function reminderScanRangeWithWorkWeek(
  now: Date,
  settings: WorkWeekSettings | null | undefined,
  graceMinutes = REMINDER_GRACE_MINUTES,
  horizonHours = REMINDER_HORIZON_HOURS,
): { start: Date; end: Date } {
  const base = reminderScanRange(now, graceMinutes, horizonHours)
  if (!settings?.muteOutsideHours || !settings.workCalendarId) return base
  const deferredStart = previousWorkPeriodEnd(now, settings)
  return {
    start: deferredStart.getTime() < base.start.getTime() ? deferredStart : base.start,
    end: base.end,
  }
}

export function reminderFireKey(eventId: string, originalStartsAt: Date): string {
  return `${eventId}:${originalStartsAt.toISOString()}`
}

export type ReminderDueOptions = {
  graceMinutes?: number
  snoozeActive?: (eventId: string) => boolean
  workWeek?: WorkWeekSettings | null
}

function appliesWorkMute(
  occ: Pick<Occurrence, 'calendarId'>,
  settings: WorkWeekSettings | null | undefined,
): settings is WorkWeekSettings {
  return !!settings && isWorkCalendarMuted(settings, occ.calendarId)
}

export function isOccurrenceDueForReminder(
  occ: Pick<Occurrence, 'eventId' | 'calendarId' | 'startsAt' | 'reminderMinutes'>,
  now: Date,
  options?: ReminderDueOptions,
): boolean {
  const graceMinutes = options?.graceMinutes ?? REMINDER_GRACE_MINUTES
  if (options?.snoozeActive?.(occ.eventId)) return false

  const remindAt = addMinutes(occ.startsAt, -occ.reminderMinutes)
  if (remindAt > now) return false

  const settings = options?.workWeek
  if (appliesWorkMute(occ, settings)) {
    if (!isWithinWorkHours(now, settings)) return false
    const holdSince = previousWorkPeriodEnd(now, settings)
    return remindAt.getTime() >= holdSince.getTime()
  }

  if (occ.startsAt < addMinutes(now, -graceMinutes)) return false
  return true
}

export function selectDueReminders(
  occurrences: Occurrence[],
  now: Date,
  fired: ReadonlySet<string>,
  options?: ReminderDueOptions,
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
