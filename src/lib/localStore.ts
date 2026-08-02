import type { Calendar, CalendarEvent, EventException } from '../types'
import { createId } from './id'
import { clampText, isValidEmail } from './security'

const KEY = 'calendario.local.v1'

type LocalDb = {
  userId: string
  email: string
  displayName: string
  calendars: Calendar[]
  events: CalendarEvent[]
  exceptions: EventException[]
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
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
    return parsed
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
