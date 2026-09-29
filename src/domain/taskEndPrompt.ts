import type { Calendar, CalendarEvent, EventDraft, EventException, Occurrence } from '../types'
import { expandOccurrences } from './recurrence'

export const TASK_END_EXTEND_MS = 60 * 60 * 1000

export type TaskEndCheckpoint = {
  eventId: string
  title: string
  description: string
  calendarId: string
  startsAt: Date
  endsAt: Date
  originalStartsAt: Date
  allDay: boolean
  reminderMinutes: number
  isRecurring: boolean
}

export function taskEndPromptKey(eventId: string, endsAt: Date): string {
  return `${eventId}:${endsAt.toISOString()}`
}

/** Suma una hora a la hora de fin. Si esa hora ya pasó, la próxima pregunta queda a una hora de ahora. */
export function extendedTaskEnd(currentEnd: Date, now: Date): Date {
  const plusHour = new Date(currentEnd.getTime() + TASK_END_EXTEND_MS)
  if (plusHour.getTime() > now.getTime()) return plusHour
  return new Date(now.getTime() + TASK_END_EXTEND_MS)
}

function fallbackCalendar(event: CalendarEvent): Calendar {
  return {
    id: event.calendar_id,
    user_id: event.user_id,
    name: 'Calendario',
    color: '#888888',
    is_default: false,
    visible: true,
    created_at: event.created_at,
  }
}

function chooseOccurrence(occurrences: Occurrence[], anchor: Date): Occurrence | null {
  const upcoming = occurrences
    .filter((occ) => occ.endsAt.getTime() > anchor.getTime())
    .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime())
  if (upcoming[0]) return upcoming[0]
  const past = [...occurrences].sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())
  return past[0] ?? null
}

export function taskEndCheckpoint(
  event: CalendarEvent,
  calendars: Calendar[],
  exceptions: EventException[],
  now: Date,
): TaskEndCheckpoint | null {
  if (event.kind !== 'task' || event.task_status !== 'in_progress') return null
  const anchor = event.task_started_at ? new Date(event.task_started_at) : now
  if (Number.isNaN(anchor.getTime()) || Number.isNaN(now.getTime())) return null

  const calendar = calendars.find((item) => item.id === event.calendar_id) ?? fallbackCalendar(event)
  const from = new Date(Math.min(anchor.getTime(), now.getTime()) - 60 * 60 * 1000)
  const to = new Date(Math.max(anchor.getTime(), now.getTime()) + 60 * 60 * 1000)
  const occurrences = expandOccurrences([event], [calendar], exceptions, from, to).filter(
    (occ) => occ.eventId === event.id,
  )
  const chosen = chooseOccurrence(occurrences, anchor)

  const startsAt = chosen?.startsAt ?? new Date(event.starts_at)
  const endsAt = chosen?.endsAt ?? new Date(event.ends_at)
  const originalStartsAt = chosen?.originalStartsAt ?? new Date(event.starts_at)
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    Number.isNaN(originalStartsAt.getTime())
  ) {
    return null
  }

  return {
    eventId: event.id,
    title: chosen?.title || event.title,
    description: chosen?.description ?? event.description,
    calendarId: event.calendar_id,
    startsAt,
    endsAt,
    originalStartsAt,
    allDay: chosen?.allDay ?? event.all_day,
    reminderMinutes: chosen?.reminderMinutes ?? event.reminder_minutes,
    isRecurring: chosen?.isRecurring ?? Boolean(event.rrule),
  }
}

export function isTaskEndDue(checkpoint: Pick<TaskEndCheckpoint, 'endsAt'>, now: Date): boolean {
  return checkpoint.endsAt.getTime() <= now.getTime()
}

export function selectDueTaskEndPrompts(
  events: CalendarEvent[],
  calendars: Calendar[],
  exceptions: EventException[],
  now: Date,
  promptedKeys: ReadonlySet<string>,
): TaskEndCheckpoint[] {
  const due: TaskEndCheckpoint[] = []
  for (const event of events) {
    const checkpoint = taskEndCheckpoint(event, calendars, exceptions, now)
    if (!checkpoint || !isTaskEndDue(checkpoint, now)) continue
    if (promptedKeys.has(taskEndPromptKey(checkpoint.eventId, checkpoint.endsAt))) continue
    due.push(checkpoint)
  }
  due.sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime() || a.eventId.localeCompare(b.eventId))
  return due
}

export function taskEndExtensionDraft(
  event: CalendarEvent,
  checkpoint: TaskEndCheckpoint,
  now: Date,
): EventDraft {
  return {
    id: event.id,
    calendar_id: event.calendar_id,
    title: checkpoint.title || event.title,
    description: checkpoint.description,
    starts_at: checkpoint.startsAt.toISOString(),
    ends_at: extendedTaskEnd(checkpoint.endsAt, now).toISOString(),
    all_day: checkpoint.allDay,
    reminder_minutes: checkpoint.reminderMinutes,
    rrule: event.rrule,
    kind: 'task',
    editScope: checkpoint.isRecurring ? 'single' : 'series',
    occurrenceOriginalStartsAt: checkpoint.isRecurring
      ? checkpoint.originalStartsAt.toISOString()
      : undefined,
  }
}
