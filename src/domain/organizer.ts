import { rrulestr, RRule } from 'rrule'
import type { Calendar, CalendarEvent, EventException, Occurrence } from '../types'
import { expandOccurrences, labelForRRule, recurrenceEndFromRRule } from './recurrence'

export type OrganizerEntry = {
  occurrence: Occurrence
  master: CalendarEvent
  calendar: Calendar
  recurrenceLabel: string | null
  recurrenceEndsAt: Date | null
}

export type OrganizerItems = {
  upcoming: OrganizerEntry[]
  past: OrganizerEntry[]
}

function occurrenceAtOriginal(
  event: CalendarEvent,
  calendars: Calendar[],
  exceptions: EventException[],
  original: Date,
): Occurrence | null {
  return (
    expandOccurrences([event], calendars, exceptions, original, original).find(
      (occurrence) => occurrence.originalStartsAt.getTime() === original.getTime(),
    ) ?? null
  )
}

function eventRule(event: CalendarEvent): RRule | null {
  if (!event.rrule) return null
  try {
    return rrulestr(event.rrule, { dtstart: new Date(event.starts_at) }) as RRule
  } catch {
    return null
  }
}

function exceptionOccurrences(
  event: CalendarEvent,
  calendars: Calendar[],
  exceptions: EventException[],
): Occurrence[] {
  const result = new Map<number, Occurrence>()
  for (const exception of exceptions) {
    if (exception.event_id !== event.id || exception.is_cancelled) continue
    const original = new Date(exception.original_starts_at)
    if (Number.isNaN(original.getTime())) continue
    const occurrence = occurrenceAtOriginal(event, calendars, exceptions, original)
    if (occurrence) result.set(original.getTime(), occurrence)
  }
  return [...result.values()]
}

function nearestUpcomingOccurrence(
  event: CalendarEvent,
  calendars: Calendar[],
  exceptions: EventException[],
  now: Date,
): Occurrence | null {
  const rule = eventRule(event)
  if (!rule) return null

  const candidates = new Map<number, Occurrence>()
  const previousOriginal = rule.before(now, true)
  if (previousOriginal) {
    const previous = occurrenceAtOriginal(event, calendars, exceptions, previousOriginal)
    if (previous && previous.endsAt >= now) {
      candidates.set(previous.originalStartsAt.getTime(), previous)
    }
  }

  for (const occurrence of exceptionOccurrences(event, calendars, exceptions)) {
    if (occurrence.endsAt >= now) {
      candidates.set(occurrence.originalStartsAt.getTime(), occurrence)
    }
  }

  let cursor = now
  const maxAttempts = exceptions.filter((exception) => exception.event_id === event.id).length + 2
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const original = rule.after(cursor, true)
    if (!original) break
    const occurrence = occurrenceAtOriginal(event, calendars, exceptions, original)
    if (occurrence && occurrence.endsAt >= now) {
      candidates.set(occurrence.originalStartsAt.getTime(), occurrence)
      break
    }
    cursor = new Date(original.getTime() + 1)
  }

  return (
    [...candidates.values()].sort(
      (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
    )[0] ?? null
  )
}

function lastPastOccurrence(
  event: CalendarEvent,
  calendars: Calendar[],
  exceptions: EventException[],
  now: Date,
): Occurrence | null {
  const rule = eventRule(event)
  if (!rule) return null

  const candidates = new Map<number, Occurrence>()
  for (const occurrence of exceptionOccurrences(event, calendars, exceptions)) {
    if (occurrence.endsAt < now) {
      candidates.set(occurrence.originalStartsAt.getTime(), occurrence)
    }
  }

  let cursor = now
  const maxAttempts = exceptions.filter((exception) => exception.event_id === event.id).length + 2
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const original = rule.before(cursor, true)
    if (!original) break
    const occurrence = occurrenceAtOriginal(event, calendars, exceptions, original)
    if (occurrence && occurrence.endsAt < now) {
      candidates.set(occurrence.originalStartsAt.getTime(), occurrence)
      break
    }
    cursor = new Date(original.getTime() - 1)
  }

  return (
    [...candidates.values()].sort(
      (left, right) => right.startsAt.getTime() - left.startsAt.getTime(),
    )[0] ?? null
  )
}

function entryFor(
  occurrence: Occurrence,
  event: CalendarEvent,
  calendar: Calendar,
): OrganizerEntry {
  return {
    occurrence,
    master: event,
    calendar,
    recurrenceLabel: labelForRRule(event.rrule),
    recurrenceEndsAt: recurrenceEndFromRRule(event.rrule, new Date(event.starts_at)),
  }
}

export function buildOrganizerItems(
  events: CalendarEvent[],
  calendars: Calendar[],
  exceptions: EventException[],
  now: Date,
  pastSince: Date,
): OrganizerItems {
  const calendarMap = new Map(calendars.filter((calendar) => calendar.visible).map((calendar) => [calendar.id, calendar]))
  const upcoming: OrganizerEntry[] = []
  const past: OrganizerEntry[] = []

  for (const event of events) {
    const calendar = calendarMap.get(event.calendar_id)
    if (!calendar) continue

    if (!event.rrule) {
      const occurrence = occurrenceAtOriginal(event, calendars, exceptions, new Date(event.starts_at))
      if (!occurrence) continue
      if (occurrence.endsAt >= now) {
        upcoming.push(entryFor(occurrence, event, calendar))
      } else if (occurrence.endsAt >= pastSince) {
        past.push(entryFor(occurrence, event, calendar))
      }
      continue
    }

    const next = nearestUpcomingOccurrence(event, calendars, exceptions, now)
    if (next) {
      upcoming.push(entryFor(next, event, calendar))
      continue
    }

    const previous = lastPastOccurrence(event, calendars, exceptions, now)
    if (previous && previous.endsAt >= pastSince) {
      past.push(entryFor(previous, event, calendar))
    }
  }

  upcoming.sort((left, right) => left.occurrence.startsAt.getTime() - right.occurrence.startsAt.getTime())
  past.sort((left, right) => right.occurrence.startsAt.getTime() - left.occurrence.startsAt.getTime())
  return { upcoming, past }
}
