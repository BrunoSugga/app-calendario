import { beforeEach, describe, expect, it } from 'vitest'
import {
  getLocalSession,
  loadLocalDb,
  localSignIn,
  localSignOut,
  saveLocalDb,
  setLocalSession,
} from './localStore'

describe('localStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('localSignIn crea db con calendario por defecto', () => {
    const db = localSignIn('bruno@example.com', 'Bruno')
    expect(db.email).toBe('bruno@example.com')
    expect(db.displayName).toBe('Bruno')
    expect(db.calendars).toHaveLength(1)
    expect(db.calendars[0].is_default).toBe(true)
    expect(db.events).toEqual([])
  })

  it('reusa la misma db si el email coincide', () => {
    const first = localSignIn('bruno@example.com', 'Bruno')
    const second = localSignIn('bruno@example.com')
    expect(second.userId).toBe(first.userId)
    expect(second.calendars[0].id).toBe(first.calendars[0].id)
  })

  it('crea otra db si cambia el email', () => {
    const first = localSignIn('a@example.com')
    const second = localSignIn('b@example.com')
    expect(second.userId).not.toBe(first.userId)
  })

  it('persiste y carga desde localStorage', () => {
    const db = localSignIn('bruno@example.com', 'Bruno')
    db.events.push({
      id: 'e1',
      user_id: db.userId,
      calendar_id: db.calendars[0].id,
      title: 'Demo',
      description: '',
      starts_at: '2026-08-01T10:00:00.000Z',
      ends_at: '2026-08-01T11:00:00.000Z',
      all_day: false,
      reminder_minutes: 15,
      rrule: null,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
    })
    saveLocalDb(db)
    const loaded = loadLocalDb()
    expect(loaded?.events).toHaveLength(1)
    expect(loaded?.events[0].title).toBe('Demo')
  })

  it('maneja JSON inválido', () => {
    localStorage.setItem('calendario.local.v1', '{not-json')
    expect(loadLocalDb()).toBeNull()
  })

  it('sesión local se limpia al salir sin borrar datos', () => {
    localSignIn('bruno@example.com', 'Bruno')
    setLocalSession('bruno@example.com')
    expect(getLocalSession()).toBe('bruno@example.com')
    localSignOut()
    expect(getLocalSession()).toBeNull()
    expect(loadLocalDb()?.email).toBe('bruno@example.com')
  })
})
