import type { Calendar, CalendarEvent, EventException } from '../types'
import { createId } from './id'

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

export function loadLocalDb(): LocalDb | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LocalDb
  } catch {
    return null
  }
}

export function saveLocalDb(db: LocalDb): void {
  localStorage.setItem(KEY, JSON.stringify(db))
}

export function localSignIn(email: string, displayName?: string): LocalDb {
  const existing = loadLocalDb()
  if (existing && existing.email === email) return existing
  const db = emptyDb(email, displayName || email.split('@')[0] || 'Usuario')
  saveLocalDb(db)
  return db
}

export function localSignOut(): void {
  // keep data; just clear session marker
  localStorage.removeItem('calendario.session')
}

export function setLocalSession(email: string): void {
  localStorage.setItem('calendario.session', email)
}

export function getLocalSession(): string | null {
  return localStorage.getItem('calendario.session')
}
