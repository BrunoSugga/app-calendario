import { addMinutes, format, formatISO } from 'date-fns'
import {
  reminderFireKey,
} from '../domain/reminders'
import { reminderLeadMinutes } from '../domain/reschedule'
import {
  isWithinWorkHours,
  isWorkCalendarMuted,
  nextWorkPeriodStart,
  type WorkWeekSettings,
} from '../domain/workWeek'
import { clampText, isSafeId, isSafeIsoDate } from './security'
import type { EventKind, Occurrence } from '../types'
import { normalizeEventKind } from '../types'

export function persistFiredKey(fireKey: string): void {
  if (!fireKey || fireKey.length > 200) return
  try {
    const raw = localStorage.getItem('calendario.reminders.fired')
    const values = new Set(raw ? (JSON.parse(raw) as string[]) : [])
    values.add(fireKey)
    localStorage.setItem('calendario.reminders.fired', JSON.stringify([...values].slice(-500)))
  } catch {
    // ignore
  }
}

export const NATIVE_REMINDER_HORIZON_HOURS = 48
export const NATIVE_REMINDER_MAX = 100
export const NATIVE_TITLE_MAX = 80
export const NATIVE_BODY_MAX = 120

export type NativeReminderExtra = {
  eventId: string
  startsAt: string
  originalStartsAt: string
  kind: EventKind
  title: string
  timeLabel: string
  calendarName: string
  reminderMinutes: number
}

export type NativeReminderScheduleItem = {
  id: number
  title: string
  body: string
  at: Date
  extra: NativeReminderExtra
  fireKey: string
}

export type ScheduleFromOccurrencesOptions = {
  now: Date
  calendars: ReadonlyArray<{ id: string; name: string }>
  workWeek?: WorkWeekSettings | null
  fired?: ReadonlySet<string>
  snoozeActive?: (eventId: string) => boolean
  horizonHours?: number
  max?: number
}

function stripUnsafeVisibleText(value: string, max: number): string {
  const stripped = value.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '')
  return clampText(stripped, max)
}

/** Hash FNV-1a → int32 positivo (1..2147483646) para AlarmManager. */
export function notificationIdFromFireKey(fireKey: string): number {
  let hash = 2166136261
  for (let i = 0; i < fireKey.length; i++) {
    hash ^= fireKey.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 2147483646) + 1
}

export function effectiveNativeFireAt(
  occ: Pick<Occurrence, 'calendarId' | 'startsAt' | 'reminderMinutes'>,
  workWeek?: WorkWeekSettings | null,
): Date {
  const remindAt = addMinutes(occ.startsAt, -occ.reminderMinutes)
  if (workWeek && isWorkCalendarMuted(workWeek, occ.calendarId) && !isWithinWorkHours(remindAt, workWeek)) {
    return nextWorkPeriodStart(remindAt, workWeek)
  }
  return remindAt
}

export function parseNotificationExtra(extra: unknown): NativeReminderExtra | null {
  if (!extra || typeof extra !== 'object') return null
  const raw = extra as Record<string, unknown>
  const eventId = typeof raw.eventId === 'string' ? raw.eventId : ''
  const startsAt = typeof raw.startsAt === 'string' ? raw.startsAt : ''
  const originalStartsAt =
    typeof raw.originalStartsAt === 'string' && raw.originalStartsAt ? raw.originalStartsAt : startsAt
  if (!isSafeId(eventId) || !isSafeIsoDate(startsAt) || !isSafeIsoDate(originalStartsAt)) {
    return null
  }
  return {
    eventId,
    startsAt: clampText(startsAt, 40),
    originalStartsAt: clampText(originalStartsAt, 40),
    kind: normalizeEventKind(raw.kind),
    title: stripUnsafeVisibleText(String(raw.title ?? ''), NATIVE_TITLE_MAX),
    timeLabel: stripUnsafeVisibleText(String(raw.timeLabel ?? ''), 64),
    calendarName: stripUnsafeVisibleText(String(raw.calendarName ?? ''), 80),
    reminderMinutes: reminderLeadMinutes(raw.reminderMinutes),
  }
}

function timeLabelOf(occ: Occurrence): string {
  return occ.kind === 'reminder'
    ? format(occ.startsAt, 'HH:mm')
    : `${format(occ.startsAt, 'HH:mm')} - ${format(occ.endsAt, 'HH:mm')}`
}

/**
 * Ocurrencias futuras → lote a programar en LocalNotifications.
 * Sin descripción ni HTML en el texto visible. Tope y horizonte acotados.
 */
export function scheduleFromOccurrences(
  occurrences: Occurrence[],
  options: ScheduleFromOccurrencesOptions,
): NativeReminderScheduleItem[] {
  const now = options.now
  const horizonHours = options.horizonHours ?? NATIVE_REMINDER_HORIZON_HOURS
  const max = options.max ?? NATIVE_REMINDER_MAX
  const horizonEnd = addMinutes(now, horizonHours * 60)
  const fired = options.fired ?? new Set<string>()
  const calendarName = (id: string) =>
    options.calendars.find((c) => c.id === id)?.name ?? 'Calendario'

  const pending: NativeReminderScheduleItem[] = []
  const usedIds = new Set<number>()

  for (const occ of occurrences) {
    if (options.snoozeActive?.(occ.eventId)) continue
    const fireKey = reminderFireKey(occ.eventId, occ.originalStartsAt)
    if (fired.has(fireKey)) continue
    if (!isSafeId(occ.eventId)) continue

    const at = effectiveNativeFireAt(occ, options.workWeek)
    if (at.getTime() <= now.getTime()) continue
    if (at.getTime() > horizonEnd.getTime()) continue

    const id = notificationIdFromFireKey(fireKey)
    if (usedIds.has(id)) continue
    usedIds.add(id)

    const title = stripUnsafeVisibleText(occ.title || 'Recordatorio', NATIVE_TITLE_MAX)
    const timeLabel = timeLabelOf(occ)
    const name = stripUnsafeVisibleText(calendarName(occ.calendarId), 80)
    const body = stripUnsafeVisibleText(`${timeLabel} · ${name}`, NATIVE_BODY_MAX)

    pending.push({
      id,
      title,
      body,
      at,
      fireKey,
      extra: {
        eventId: occ.eventId,
        startsAt: formatISO(occ.startsAt),
        originalStartsAt: formatISO(occ.originalStartsAt),
        kind: occ.kind,
        title,
        timeLabel,
        calendarName: name,
        reminderMinutes: reminderLeadMinutes(occ.reminderMinutes),
      },
    })
  }

  pending.sort((a, b) => a.at.getTime() - b.at.getTime())
  return pending.slice(0, max)
}
