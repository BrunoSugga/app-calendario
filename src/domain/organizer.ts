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

function occurrenceKey(occurrence: Occurrence): string {
  return `${occurrence.eventId}:${occurrence.originalStartsAt.getTime()}`
}

export function buildOrganizerItems(
  events: CalendarEvent[],
  calendars: Calendar[],
  exceptions: EventException[],
  now: Date,
  pastSince: Date,
  upcomingUntil: Date,
): OrganizerItems {
  const calendarMap = new Map(calendars.filter((calendar) => calendar.visible).map((calendar) => [calendar.id, calendar]))
  const eventMap = new Map(events.map((event) => [event.id, event]))
  const upcoming: OrganizerEntry[] = []
  const past: OrganizerEntry[] = []
  const seenUpcoming = new Set<string>()
  const upcomingEventIds = new Set<string>()

  const pushUpcoming = (occurrence: Occurrence) => {
    const key = occurrenceKey(occurrence)
    const master = eventMap.get(occurrence.eventId)
    const calendar = calendarMap.get(occurrence.calendarId)
    if (!master || !calendar || seenUpcoming.has(key)) return
    seenUpcoming.add(key)
    upcomingEventIds.add(master.id)
    upcoming.push(entryFor(occurrence, master, calendar))
  }

  for (const occurrence of expandOccurrences(events, calendars, exceptions, pastSince, upcomingUntil)) {
    if (occurrence.endsAt >= now) {
      pushUpcoming(occurrence)
      continue
    }
    if (occurrence.endsAt < pastSince) continue
    const master = eventMap.get(occurrence.eventId)
    const calendar = calendarMap.get(occurrence.calendarId)
    if (!master || !calendar) continue
    past.push(entryFor(occurrence, master, calendar))
  }

  for (const event of events) {
    const calendar = calendarMap.get(event.calendar_id)
    if (!calendar) continue

    if (!event.rrule) {
      const occurrence = occurrenceAtOriginal(event, calendars, exceptions, new Date(event.starts_at))
      if (occurrence && occurrence.startsAt > upcomingUntil && occurrence.endsAt >= now) {
        pushUpcoming(occurrence)
      }
      continue
    }

    if (upcomingEventIds.has(event.id)) continue
    const next = nearestUpcomingOccurrence(event, calendars, exceptions, now)
    if (next) pushUpcoming(next)
  }

  upcoming.sort((left, right) => left.occurrence.startsAt.getTime() - right.occurrence.startsAt.getTime())
  past.sort((left, right) => right.occurrence.startsAt.getTime() - left.occurrence.startsAt.getTime())
  return { upcoming, past }
}
