import { beforeEach, describe, expect, it } from 'vitest'
import {
  assertBackupFileWithinLimit,
  buildCalendarBackup,
  MAX_BACKUP_EVENTS,
  MAX_BACKUP_EXCEPTIONS,
  MAX_BACKUP_FILE_BYTES,
  MAX_BACKUP_TASK_RUNS,
  parseCalendarBackup,
  remapBackupForImport,
} from './calendarBackup'
import { localSignIn } from './localStore'
import { createLocalCalendarRepository } from './repositories/localCalendarRepository'

describe('calendarBackup + deleteCalendar', () => {
  beforeEach(() => {
    localStorage.clear()
    localSignIn('bruno@example.com', 'Bruno')
  })

  it('exporta, importa con nuevos ids y delete con move', async () => {
    const repo = createLocalCalendarRepository()
    let state = await repo.load()
    const userId = state.calendars[0].user_id
    const firstId = state.calendars[0].id

    state = await repo.createCalendar(state, userId, 'Trabajo', '#111111')
    const secondId = state.calendars[1].id

    state = await repo.saveEvent(state, userId, {
      calendar_id: secondId,
      title: 'Standup',
      description: '',
      starts_at: '2026-08-05T10:00:00.000Z',
      ends_at: '2026-08-05T10:30:00.000Z',
      all_day: false,
      reminder_minutes: 5,
      rrule: null,
      kind: 'event',
    })
    expect(state.events).toHaveLength(1)

    const backup = buildCalendarBackup(state, secondId)
    expect(backup.version).toBe(1)
    expect(backup.events).toHaveLength(1)
    expect(backup.calendar.name).toBe('Trabajo')

    const parsed = parseCalendarBackup(JSON.parse(JSON.stringify(backup)), userId)
    const remapped = remapBackupForImport(parsed, userId)
    expect(remapped.calendar.id).not.toBe(secondId)
    expect(remapped.events[0].id).not.toBe(backup.events[0].id)
    expect(remapped.events[0].calendar_id).toBe(remapped.calendar.id)

    state = await repo.deleteCalendar(state, secondId, userId, { moveToCalendarId: firstId })
    expect(state.calendars).toHaveLength(1)
    expect(state.events[0].calendar_id).toBe(firstId)

    state = await repo.importCalendarBackup(state, userId, remapped)
    expect(state.calendars).toHaveLength(2)
    expect(state.events).toHaveLength(2)
  })

  it('no permite borrar el único calendario y cascadea eventos', async () => {
    const repo = createLocalCalendarRepository()
    let state = await repo.load()
    const userId = state.calendars[0].user_id
    const onlyId = state.calendars[0].id

    await expect(repo.deleteCalendar(state, onlyId, userId)).rejects.toThrow(
      /único calendario/i,
    )

    state = await repo.createCalendar(state, userId, 'Extra', '#ABCDEF')
    const extraId = state.calendars[1].id
    state = await repo.saveEvent(state, userId, {
      calendar_id: extraId,
      title: 'Temp',
      description: '',
      starts_at: '2026-08-05T10:00:00.000Z',
      ends_at: '2026-08-05T11:00:00.000Z',
      all_day: false,
      reminder_minutes: 0,
      rrule: null,
      kind: 'reminder',
    })

    state = await repo.deleteCalendar(state, extraId, userId)
    expect(state.calendars).toHaveLength(1)
    expect(state.events).toHaveLength(0)
  })

  it('updateCalendar renombra y cambia color', async () => {
    const repo = createLocalCalendarRepository()
    let state = await repo.load()
    const id = state.calendars[0].id
    state = await repo.updateCalendar(state, id, { name: 'Casa', color: '#FF00AA' })
    expect(state.calendars[0].name).toBe('Casa')
    expect(state.calendars[0].color).toBe('#FF00AA')
  })

  it('rechaza archivos de respaldo demasiado grandes o vacíos', () => {
    expect(() => assertBackupFileWithinLimit({ size: 0 })).toThrow(/vacío/i)
    expect(() => assertBackupFileWithinLimit({ size: MAX_BACKUP_FILE_BYTES + 1 })).toThrow(
      /máximo/i,
    )
    expect(() => assertBackupFileWithinLimit({ size: 12 })).not.toThrow()
  })

  it('rechaza arrays de excepciones o taskRuns fuera de tope', () => {
    const base = {
      version: 1,
      exportedAt: '2026-08-09T12:00:00.000Z',
      calendar: { name: 'X', color: '#3D9BE0' },
      events: [] as unknown[],
      exceptions: [] as unknown[],
      taskRuns: [] as unknown[],
    }

    expect(() =>
      parseCalendarBackup(
        {
          ...base,
          events: Array.from({ length: MAX_BACKUP_EVENTS + 1 }, () => ({})),
        },
        'user-1',
      ),
    ).toThrow(/eventos/i)

    expect(() =>
      parseCalendarBackup(
        {
          ...base,
          exceptions: Array.from({ length: MAX_BACKUP_EXCEPTIONS + 1 }, () => ({})),
        },
        'user-1',
      ),
    ).toThrow(/excepciones/i)

    expect(() =>
      parseCalendarBackup(
        {
          ...base,
          taskRuns: Array.from({ length: MAX_BACKUP_TASK_RUNS + 1 }, () => ({})),
        },
        'user-1',
      ),
    ).toThrow(/historial/i)
  })
})
