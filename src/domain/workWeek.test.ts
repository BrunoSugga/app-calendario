import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORK_WEEK,
  isWithinWorkHours,
  isWorkCalendarMuted,
  minutesToTimeInput,
  normalizeWorkWeekSettings,
  previousWorkPeriodEnd,
  timeInputToMinutes,
  type WorkWeekSettings,
} from './workWeek'

const monFri: WorkWeekSettings = {
  ...DEFAULT_WORK_WEEK,
  workCalendarId: 'work',
  muteOutsideHours: true,
}

describe('isWithinWorkHours', () => {
  it('incluye el inicio y excluye el fin (L–V 8–17)', () => {
    // Lunes
    expect(isWithinWorkHours(new Date('2026-08-03T08:00:00'), monFri)).toBe(true)
    expect(isWithinWorkHours(new Date('2026-08-03T16:59:00'), monFri)).toBe(true)
    expect(isWithinWorkHours(new Date('2026-08-03T17:00:00'), monFri)).toBe(false)
    expect(isWithinWorkHours(new Date('2026-08-03T07:59:00'), monFri)).toBe(false)
  })

  it('fuera de días laborales', () => {
    // Sábado
    expect(isWithinWorkHours(new Date('2026-08-08T10:00:00'), monFri)).toBe(false)
    // Domingo
    expect(isWithinWorkHours(new Date('2026-08-09T10:00:00'), monFri)).toBe(false)
  })
})

describe('previousWorkPeriodEnd', () => {
  it('en lunes dentro de jornada apunta al viernes 17:00', () => {
    const now = new Date('2026-08-10T08:30:00') // lunes
    const end = previousWorkPeriodEnd(now, monFri)
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(7)
    expect(end.getDate()).toBe(7) // viernes
    expect(end.getHours()).toBe(17)
    expect(end.getMinutes()).toBe(0)
  })

  it('después del fin de jornada usa el fin de hoy', () => {
    const now = new Date('2026-08-07T18:00:00') // viernes
    const end = previousWorkPeriodEnd(now, monFri)
    expect(end.getDate()).toBe(7)
    expect(end.getHours()).toBe(17)
  })

  it('el sábado apunta al viernes', () => {
    const now = new Date('2026-08-08T12:00:00')
    const end = previousWorkPeriodEnd(now, monFri)
    expect(end.getDate()).toBe(7)
    expect(end.getHours()).toBe(17)
  })
})

describe('helpers', () => {
  it('isWorkCalendarMuted solo con mute + mismo calendario', () => {
    expect(isWorkCalendarMuted(monFri, 'work')).toBe(true)
    expect(isWorkCalendarMuted(monFri, 'personal')).toBe(false)
    expect(isWorkCalendarMuted({ ...monFri, muteOutsideHours: false }, 'work')).toBe(false)
    expect(isWorkCalendarMuted({ ...monFri, workCalendarId: null }, 'work')).toBe(false)
  })

  it('convierte time input ↔ minutos', () => {
    expect(minutesToTimeInput(480)).toBe('08:00')
    expect(minutesToTimeInput(1020)).toBe('17:00')
    expect(timeInputToMinutes('08:00')).toBe(480)
    expect(timeInputToMinutes('17:00')).toBe(1020)
    expect(timeInputToMinutes('bad')).toBeNull()
  })

  it('normalize acepta snake_case de Postgres', () => {
    const settings = normalizeWorkWeekSettings({
      work_calendar_id: 'abc',
      work_days: [1, 2, 3],
      start_minute: 540,
      end_minute: 1080,
      mute_outside_hours: true,
    })
    expect(settings).toEqual({
      workCalendarId: 'abc',
      workDays: [1, 2, 3],
      startMinute: 540,
      endMinute: 1080,
      muteOutsideHours: true,
    })
  })
})
