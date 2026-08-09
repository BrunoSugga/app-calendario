import { beforeEach, describe, expect, it } from 'vitest'
import type { Calendar } from '../types'
import {
  applyDevicePrefs,
  loadDevicePrefs,
  pruneDevicePrefsAfterDelete,
  resolveDevicePrefs,
  saveDevicePrefs,
  seedDevicePrefsFromCalendars,
  setDefaultInPrefs,
  toggleHiddenInPrefs,
} from './deviceCalendarPrefs'

function cal(partial: Partial<Calendar> & Pick<Calendar, 'id'>): Calendar {
  return {
    user_id: 'u1',
    name: partial.name ?? 'Cal',
    color: '#3D9BE0',
    is_default: false,
    visible: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('deviceCalendarPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('siembra desde calendarios y aplica overlay', () => {
    const calendars = [
      cal({ id: 'a', is_default: true, visible: true, name: 'Personal' }),
      cal({ id: 'b', is_default: false, visible: false, name: 'Trabajo' }),
    ]
    const seeded = seedDevicePrefsFromCalendars(calendars)
    expect(seeded.defaultCalendarId).toBe('a')
    expect(seeded.hiddenIds).toEqual(['b'])

    const applied = applyDevicePrefs(calendars, {
      defaultCalendarId: 'b',
      hiddenIds: ['a'],
    })
    expect(applied.find((c) => c.id === 'b')?.is_default).toBe(true)
    expect(applied.find((c) => c.id === 'a')?.is_default).toBe(false)
    expect(applied.find((c) => c.id === 'a')?.visible).toBe(false)
    expect(applied.find((c) => c.id === 'b')?.visible).toBe(true)
  })

  it('persiste por usuario y resolve limpia ids huérfanos', () => {
    const calendars = [cal({ id: 'a', is_default: true }), cal({ id: 'b' })]
    saveDevicePrefs('user-1', { defaultCalendarId: 'gone', hiddenIds: ['gone', 'b'] })
    const prefs = resolveDevicePrefs('user-1', calendars)
    expect(prefs.defaultCalendarId).toBe('a')
    expect(prefs.hiddenIds).toEqual(['b'])
    expect(loadDevicePrefs('user-1')).toEqual(prefs)
  })

  it('toggle y default solo mutan prefs', () => {
    let prefs = { defaultCalendarId: 'a', hiddenIds: [] as string[] }
    prefs = toggleHiddenInPrefs(prefs, 'a')
    expect(prefs.hiddenIds).toEqual(['a'])
    prefs = toggleHiddenInPrefs(prefs, 'a')
    expect(prefs.hiddenIds).toEqual([])
    prefs = setDefaultInPrefs(prefs, 'b')
    expect(prefs.defaultCalendarId).toBe('b')
  })

  it('prune tras borrar reasigna default', () => {
    const next = pruneDevicePrefsAfterDelete(
      { defaultCalendarId: 'a', hiddenIds: ['a', 'b'] },
      'a',
      ['b', 'c'],
    )
    expect(next.defaultCalendarId).toBe('b')
    expect(next.hiddenIds).toEqual(['b'])
  })
})
