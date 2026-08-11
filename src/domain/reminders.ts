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
/** Ventana de popups individuales al reabrir tras un cierre. */
export const REMINDER_MAX_CATCHUP_DAYS = 15

export function reminderCatchUpFrom(
  now: Date,
  lastScan: Date | null | undefined,
  graceMinutes = REMINDER_GRACE_MINUTES,
): Date {
  if (!lastScan || Number.isNaN(lastScan.getTime())) {
    return addMinutes(now, -graceMinutes)
  }
  return lastScan
}

/** Límite inferior de avisos que abren popup (más viejos van al modal resumen). */
export function reminderPopupCutoff(
  now: Date,
  maxCatchUpDays = REMINDER_MAX_CATCHUP_DAYS,
): Date {
  return addMinutes(now, -maxCatchUpDays * 24 * 60)
}

export function reminderPopupFrom(
  now: Date,
  lastScan: Date | null | undefined,
  graceMinutes = REMINDER_GRACE_MINUTES,
  maxCatchUpDays = REMINDER_MAX_CATCHUP_DAYS,
): Date {
  const catchUpFrom = reminderCatchUpFrom(now, lastScan, graceMinutes)
  const cutoff = reminderPopupCutoff(now, maxCatchUpDays)
  return catchUpFrom.getTime() > cutoff.getTime() ? catchUpFrom : cutoff
}

export function reminderScanRange(
  now: Date,
  graceMinutes = REMINDER_GRACE_MINUTES,
  horizonHours = REMINDER_HORIZON_HOURS,
  lookbackStart?: Date | null,
): { start: Date; end: Date } {
  const graceStart = addMinutes(now, -graceMinutes)
  const start =
    lookbackStart && !Number.isNaN(lookbackStart.getTime()) && lookbackStart.getTime() < graceStart.getTime()
      ? lookbackStart
      : graceStart
  return {
    // Incluye eventos/recordatorios que ya empezaron dentro de la gracia
    // (crítico para kind=reminder con ends_at === starts_at).
    start,
    end: addMinutes(now, horizonHours * 60),
  }
}

/** Amplía el lookback (lastScan / mute laboral) para no perder avisos diferidos o de catch-up. */
export function reminderScanRangeWithWorkWeek(
  now: Date,
  settings: WorkWeekSettings | null | undefined,
  graceMinutes = REMINDER_GRACE_MINUTES,
  horizonHours = REMINDER_HORIZON_HOURS,
  lastScan?: Date | null,
): { start: Date; end: Date } {
  const lookback = reminderCatchUpFrom(now, lastScan, graceMinutes)
  const base = reminderScanRange(now, graceMinutes, horizonHours, lookback)
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
  /** Último escaneo exitoso; sin esto solo aplica la gracia corta. */
  lastScan?: Date | null
  maxCatchUpDays?: number
}

function appliesWorkMute(
  occ: Pick<Occurrence, 'calendarId'>,
  settings: WorkWeekSettings | null | undefined,
): settings is WorkWeekSettings {
  return !!settings && isWorkCalendarMuted(settings, occ.calendarId)
}

function remindAtOf(
  occ: Pick<Occurrence, 'startsAt' | 'reminderMinutes'>,
): Date {
  return addMinutes(occ.startsAt, -occ.reminderMinutes)
}

/** Elegible para popup individual (últimos 15 días desde lastScan / gracia). */
export function isOccurrenceDueForReminder(
  occ: Pick<Occurrence, 'eventId' | 'calendarId' | 'startsAt' | 'reminderMinutes'>,
  now: Date,
  options?: ReminderDueOptions,
): boolean {
  const graceMinutes = options?.graceMinutes ?? REMINDER_GRACE_MINUTES
  if (options?.snoozeActive?.(occ.eventId)) return false

  const remindAt = remindAtOf(occ)
  if (remindAt > now) return false

  const settings = options?.workWeek
  if (appliesWorkMute(occ, settings)) {
    if (!isWithinWorkHours(now, settings)) return false
    const holdSince = previousWorkPeriodEnd(now, settings)
    return remindAt.getTime() >= holdSince.getTime()
  }

  const popupFrom = reminderPopupFrom(
    now,
    options?.lastScan,
    graceMinutes,
    options?.maxCatchUpDays ?? REMINDER_MAX_CATCHUP_DAYS,
  )
  return remindAt.getTime() >= popupFrom.getTime()
}

/** Más antiguo que la ventana de popup, pero posterior a lastScan. */
export function isOccurrenceAncientMissed(
  occ: Pick<Occurrence, 'eventId' | 'calendarId' | 'startsAt' | 'reminderMinutes'>,
  now: Date,
  options?: ReminderDueOptions,
): boolean {
  const lastScan = options?.lastScan
  if (!lastScan || Number.isNaN(lastScan.getTime())) return false
  if (options?.snoozeActive?.(occ.eventId)) return false

  const remindAt = remindAtOf(occ)
  if (remindAt > now) return false

  const settings = options?.workWeek
  if (appliesWorkMute(occ, settings)) {
    // Mute laboral: no van al modal; se flushean como due al reentrar jornada.
    return false
  }

  const cutoff = reminderPopupCutoff(now, options?.maxCatchUpDays ?? REMINDER_MAX_CATCHUP_DAYS)
  if (lastScan.getTime() >= cutoff.getTime()) return false
  if (remindAt.getTime() >= cutoff.getTime()) return false
  return remindAt.getTime() >= lastScan.getTime()
}

export function selectDueReminders(
  occurrences: Occurrence[],
  now: Date,
  fired: ReadonlySet<string>,
  options?: ReminderDueOptions,
): Occurrence[] {
  return partitionMissedReminders(occurrences, now, fired, options).due
}

export function partitionMissedReminders(
  occurrences: Occurrence[],
  now: Date,
  fired: ReadonlySet<string>,
  options?: ReminderDueOptions,
): { due: Occurrence[]; ancient: Occurrence[] } {
  const due: Occurrence[] = []
  const ancient: Occurrence[] = []
  for (const occ of occurrences) {
    const key = reminderFireKey(occ.eventId, occ.originalStartsAt)
    if (fired.has(key)) continue
    if (isOccurrenceDueForReminder(occ, now, options)) {
      due.push(occ)
      continue
    }
    if (isOccurrenceAncientMissed(occ, now, options)) {
      ancient.push(occ)
    }
  }
  return { due, ancient }
}
