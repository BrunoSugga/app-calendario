import { addMilliseconds, differenceInMilliseconds } from 'date-fns'
import { Frequency, RRule, Weekday, rrulestr } from 'rrule'
import type { Calendar, CalendarEvent, EventException, Occurrence } from '../types'

export type RecurrencePreset = 'none' | 'daily' | 'weekly' | 'monthly'

/** Índices estilo rrule: 0=LU … 6=DO */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAY_OPTIONS: { index: WeekdayIndex; short: string; label: string }[] = [
  { index: 0, short: 'Lu', label: 'Lunes' },
  { index: 1, short: 'Ma', label: 'Martes' },
  { index: 2, short: 'Mi', label: 'Miércoles' },
  { index: 3, short: 'Ju', label: 'Jueves' },
  { index: 4, short: 'Vi', label: 'Viernes' },
  { index: 5, short: 'Sá', label: 'Sábado' },
  { index: 6, short: 'Do', label: 'Domingo' },
]

const WEEKDAY_RULES = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]

export function jsDateToWeekdayIndex(date: Date): WeekdayIndex {
  return ((date.getDay() + 6) % 7) as WeekdayIndex
}

export function buildRRule(
  preset: RecurrencePreset,
  startsAt: Date,
  weekdays: WeekdayIndex[] = [],
  until?: Date | null,
): string | null {
  if (preset === 'none') return null

  if (preset === 'daily') {
    return new RRule({
      freq: Frequency.DAILY,
      dtstart: startsAt,
      until: until ?? undefined,
    }).toString()
  }

  const selected =
    weekdays.length > 0 ? [...new Set(weekdays)].sort((a, b) => a - b) : [jsDateToWeekdayIndex(startsAt)]
  const byweekday = selected.map((i) => WEEKDAY_RULES[i])

  if (preset === 'weekly') {
    return new RRule({
      freq: Frequency.WEEKLY,
      dtstart: startsAt,
      until: until ?? undefined,
      byweekday,
    }).toString()
  }

  // Mensual en los días de la semana elegidos (ej. todos los martes y jueves del mes)
  return new RRule({
    freq: Frequency.MONTHLY,
    dtstart: startsAt,
    until: until ?? undefined,
    byweekday,
  }).toString()
}

export function presetFromRRule(rrule: string | null): RecurrencePreset {
  if (!rrule) return 'none'
  if (rrule.includes('FREQ=DAILY')) return 'daily'
  if (rrule.includes('FREQ=WEEKLY')) return 'weekly'
  if (rrule.includes('FREQ=MONTHLY')) return 'monthly'
  return 'none'
}

export function weekdaysFromRRule(rrule: string | null, fallbackDate?: Date): WeekdayIndex[] {
  if (!rrule) {
    return fallbackDate ? [jsDateToWeekdayIndex(fallbackDate)] : []
  }

  try {
    const rule = rrulestr(rrule, {
      dtstart: fallbackDate ?? new Date(),
    }) as RRule
    const opts = rule.origOptions
    const by = opts.byweekday
    if (!by) {
      return fallbackDate ? [jsDateToWeekdayIndex(fallbackDate)] : []
    }
    const list = Array.isArray(by) ? by : [by]
    return list
      .map((item) => {
        if (typeof item === 'number') return item as WeekdayIndex
        if (item instanceof Weekday) return item.weekday as WeekdayIndex
        const w = item as { weekday?: number }
        return (w.weekday ?? 0) as WeekdayIndex
      })
      .sort((a, b) => a - b)
  } catch {
    return fallbackDate ? [jsDateToWeekdayIndex(fallbackDate)] : []
  }
}

export function labelForRRule(rrule: string | null): string | null {
  const preset = presetFromRRule(rrule)
  if (preset === 'none') return null
  if (preset === 'daily') return 'Diariamente'

  const days = weekdaysFromRRule(rrule)
  const dayLabels = days
    .map((i) => WEEKDAY_OPTIONS.find((o) => o.index === i)?.short)
    .filter(Boolean)
    .join(', ')

  if (preset === 'weekly') {
    return dayLabels ? `Semanalmente (${dayLabels})` : 'Semanalmente'
  }
  return dayLabels ? `Mensualmente (${dayLabels})` : 'Mensualmente'
}

function expandMaster(
  event: CalendarEvent,
  calendar: Calendar,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: EventException[],
): Occurrence[] {
  const durationMs = differenceInMilliseconds(new Date(event.ends_at), new Date(event.starts_at))
  const eventExceptions = exceptions.filter((ex) => ex.event_id === event.id)

  if (!event.rrule) {
    const start = new Date(event.starts_at)
    const end = new Date(event.ends_at)
    if (end < rangeStart || start > rangeEnd) return []

    const cancelled = eventExceptions.some(
      (ex) => ex.is_cancelled && new Date(ex.original_starts_at).getTime() === start.getTime(),
    )
    if (cancelled) return []

    const override = eventExceptions.find(
      (ex) => !ex.is_cancelled && new Date(ex.original_starts_at).getTime() === start.getTime(),
    )

    return [
      {
        eventId: event.id,
        calendarId: event.calendar_id,
        title: override?.title ?? event.title,
        description: override?.description ?? event.description,
        startsAt: override?.starts_at ? new Date(override.starts_at) : start,
        endsAt: override?.ends_at ? new Date(override.ends_at) : end,
        allDay: override?.all_day ?? event.all_day,
        reminderMinutes: override?.reminder_minutes ?? event.reminder_minutes,
        color: calendar.color,
        isRecurring: false,
        originalStartsAt: start,
        kind: event.kind ?? 'event',
        taskStatus: event.task_status ?? null,
      },
    ]
  }

  let rule: RRule
  try {
    rule = rrulestr(event.rrule, { dtstart: new Date(event.starts_at) }) as RRule
  } catch {
    return []
  }

  const dates = rule.between(rangeStart, rangeEnd, true)
  const occurrences: Occurrence[] = []

  for (const original of dates) {
    const cancelled = eventExceptions.some(
      (ex) =>
        ex.is_cancelled && new Date(ex.original_starts_at).getTime() === original.getTime(),
    )
    if (cancelled) continue

    const override = eventExceptions.find(
      (ex) =>
        !ex.is_cancelled && new Date(ex.original_starts_at).getTime() === original.getTime(),
    )

    const startsAt = override?.starts_at ? new Date(override.starts_at) : original
    const endsAt = override?.ends_at
      ? new Date(override.ends_at)
      : addMilliseconds(original, durationMs)

    occurrences.push({
      eventId: event.id,
      calendarId: event.calendar_id,
      title: override?.title ?? event.title,
      description: override?.description ?? event.description,
      startsAt,
      endsAt,
      allDay: override?.all_day ?? event.all_day,
      reminderMinutes: override?.reminder_minutes ?? event.reminder_minutes,
      color: calendar.color,
      isRecurring: true,
      originalStartsAt: original,
      kind: event.kind ?? 'event',
      taskStatus: event.task_status ?? null,
    })
  }

  return occurrences
}

export function expandOccurrences(
  events: CalendarEvent[],
  calendars: Calendar[],
  exceptions: EventException[],
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const calendarMap = new Map(calendars.map((c) => [c.id, c]))
  const visible = new Set(calendars.filter((c) => c.visible).map((c) => c.id))

  const result: Occurrence[] = []
  for (const event of events) {
    if (!visible.has(event.calendar_id)) continue
    const calendar = calendarMap.get(event.calendar_id)
    if (!calendar) continue
    result.push(...expandMaster(event, calendar, rangeStart, rangeEnd, exceptions))
  }

  return result.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}
