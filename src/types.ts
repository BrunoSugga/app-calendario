export type Calendar = {
  id: string
  user_id: string
  name: string
  color: string
  is_default: boolean
  visible: boolean
  created_at: string
}

export type CalendarEvent = {
  id: string
  user_id: string
  calendar_id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  all_day: boolean
  reminder_minutes: number
  rrule: string | null
  created_at: string
  updated_at: string
}

export type EventException = {
  id: string
  event_id: string
  user_id: string
  original_starts_at: string
  is_cancelled: boolean
  title: string | null
  description: string | null
  starts_at: string | null
  ends_at: string | null
  all_day: boolean | null
  reminder_minutes: number | null
  created_at: string
}

export type Occurrence = {
  eventId: string
  calendarId: string
  title: string
  description: string
  startsAt: Date
  endsAt: Date
  allDay: boolean
  reminderMinutes: number
  color: string
  isRecurring: boolean
  originalStartsAt: Date
}

export type ViewMode = 'day' | 'week' | 'month'

export type EventDraft = {
  id?: string
  calendar_id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  all_day: boolean
  reminder_minutes: number
  rrule: string | null
  /** When editing a single occurrence of a recurring series */
  occurrenceOriginalStartsAt?: string
  editScope?: 'single' | 'series'
}
