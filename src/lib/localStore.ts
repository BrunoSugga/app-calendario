import type { Calendar, CalendarEvent, EventException, TaskRun } from '../types'
import { normalizeEventKind, normalizeTaskStatus } from '../types'
import { createId } from './id'
import { clampText, isValidEmail } from './security'

const KEY = 'calendario.local.v1'

export type LocalDb = {
  userId: string
  email: string
  displayName: string
  calendars: Calendar[]
  events: CalendarEvent[]
  exceptions: EventException[]
  taskRuns: TaskRun[]
}

function emptyDb(email: string, displayName: string): LocalDb {
  const userId = createId()
  const calendarId = createId()
  const now = new Date().toISOString()
  return {
    userId,
    email,
    displayName,
    calendars: [
      {
        id: calendarId,
        user_id: userId,
        name: `Calendario de ${displayName}`,
        color: '#2F7FD4',
        is_default: true,
        visible: true,
        created_at: now,
      },
    ],
    events: [],
    exceptions: [],
    taskRuns: [],
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function migrateEvent(raw: Record<string, unknown>): CalendarEvent {
  const kind = normalizeEventKind(raw.kind)
  return {
    id: String(raw.id),
    user_id: String(raw.user_id),
    calendar_id: String(raw.calendar_id),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    starts_at: String(raw.starts_at),
    ends_at: String(raw.ends_at),
    all_day: Boolean(raw.all_day),
    reminder_minutes: Number(raw.reminder_minutes ?? 15),
    rrule: (raw.rrule as string | null) ?? null,
    kind,
    task_status: normalizeTaskStatus(raw.task_status, kind),
    task_started_at: (raw.task_started_at as string | null) ?? null,
    task_completed_at: (raw.task_completed_at as string | null) ?? null,
    task_duration_ms:
      typeof raw.task_duration_ms === 'number' ? raw.task_duration_ms : null,
    task_note: (raw.task_note as string | null) ?? null,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: String(raw.updated_at ?? new Date().toISOString()),
  }
}

function isLocalDb(value: unknown): value is LocalDb {
  if (!isObject(value)) return false
  return (
    typeof value.userId === 'string' &&
    typeof value.email === 'string' &&
    typeof value.displayName === 'string' &&
    Array.isArray(value.calendars) &&
    Array.isArray(value.events) &&
    Array.isArray(value.exceptions)
  )
}

export function loadLocalDb(): LocalDb | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isLocalDb(parsed)) return null
    const events = (parsed.events as unknown[]).map((e) =>
      migrateEvent(e as Record<string, unknown>),
    )
    const taskRuns = Array.isArray(parsed.taskRuns)
      ? (parsed.taskRuns as TaskRun[])
      : []
    return { ...parsed, events, taskRuns }
  } catch {
    return null
  }
}

export function saveLocalDb(db: LocalDb): void {
  localStorage.setItem(KEY, JSON.stringify(db))
}

export function localSignIn(email: string, displayName?: string): LocalDb {
  const normalized = email.trim().toLowerCase()
  if (!isValidEmail(normalized)) {
    throw new Error('Correo inválido')
  }
  const existing = loadLocalDb()
  if (existing && existing.email === normalized) return existing
  const db = emptyDb(
    normalized,
    clampText(displayName || normalized.split('@')[0] || 'Usuario', 120),
  )
  saveLocalDb(db)
  return db
}

export function localSignOut(): void {
  localStorage.removeItem('calendario.session')
}

export function setLocalSession(email: string): void {
  localStorage.setItem('calendario.session', email.trim().toLowerCase())
}

export function getLocalSession(): string | null {
  return localStorage.getItem('calendario.session')
}
