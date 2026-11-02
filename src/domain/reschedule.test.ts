import { beforeEach, describe, expect, it } from 'vitest'
import { addMinutes } from 'date-fns'
import { reminderFireKey } from './reminders'
import {
  armReminderSnooze,
  movedScheduleWindow,
  nextReminderAt,
  postponedStart,
  withReagendadoPrefix,
} from './reschedule'

describe('withReagendadoPrefix', () => {
  it('prefija el título', () => {
    expect(withReagendadoPrefix('Reunión')).toBe('REAGENDADO · Reunión')
  })

  it('no duplica el prefijo', () => {
    expect(withReagendadoPrefix('REAGENDADO · Reunión')).toBe('REAGENDADO · Reunión')
    expect(withReagendadoPrefix('reagendado ayer')).toBe('reagendado ayer')
  })

  it('cubre título vacío', () => {
    expect(withReagendadoPrefix('')).toBe('REAGENDADO · Sin título')
  })
})

describe('postponedStart', () => {
  const seenAt = new Date('2026-10-08T19:10:00.000Z')

  it('cuenta el plazo desde que se pospone, no desde la hora original', () => {
    expect(postponedStart(seenAt, 5, 0).toISOString()).toBe('2026-10-08T19:15:00.000Z')
    expect(postponedStart(seenAt, 24 * 60, 0).toISOString()).toBe('2026-10-09T19:10:00.000Z')
  })

  it('conserva el anticipo para que el próximo aviso quede en el futuro', () => {
    const start = postponedStart(seenAt, 5, 15)
    expect(addMinutes(start, -15).toISOString()).toBe('2026-10-08T19:15:00.000Z')
  })

  it('mueve el fin la misma cantidad al posponer una tarea', () => {
    const start = postponedStart(seenAt, 5, 0)
    const moved = movedScheduleWindow(
      new Date('2026-10-08T19:00:00.000Z'),
      new Date('2026-10-08T20:00:00.000Z'),
      start,
      'task',
    )
    expect(moved.startsAt.toISOString()).toBe('2026-10-08T19:15:00.000Z')
    expect(moved.endsAt.toISOString()).toBe('2026-10-08T20:15:00.000Z')
  })

  it('rechaza una hora de acción inválida', () => {
    expect(Number.isNaN(postponedStart(new Date(NaN), 5, 0).getTime())).toBe(true)
  })

  it('el próximo aviso queda al cumplirse el plazo, no en el pasado', () => {
    const actedAt = new Date('2026-11-02T12:28:00.000Z')
    const start = postponedStart(actedAt, 5, 15)
    expect(nextReminderAt(start, 15).toISOString()).toBe('2026-11-02T12:33:00.000Z')
  })
})

describe('armReminderSnooze', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('frena el aviso ya visto sin borrar fired', () => {
    const eventId = 'evt-bocata'
    const original = new Date('2026-11-02T12:25:00.000Z')
    const key = reminderFireKey(eventId, original)
    localStorage.setItem('calendario.reminders.fired', JSON.stringify([key]))
    const until = new Date(Date.now() + 5 * 60 * 1000)

    armReminderSnooze(eventId, until)

    expect(localStorage.getItem(`calendario.snooze.${eventId}`)).toBe(String(until.getTime()))
    expect(JSON.parse(localStorage.getItem('calendario.reminders.fired') ?? '[]')).toContain(key)
  })

  it('no deja un snooze ya vencido', () => {
    armReminderSnooze('evt-bocata', new Date('2020-01-01T00:00:00.000Z'))
    expect(localStorage.getItem('calendario.snooze.evt-bocata')).toBeNull()
  })
})

describe('movedScheduleWindow', () => {
  it('corre el fin la misma cantidad que el inicio', () => {
    const moved = movedScheduleWindow(
      new Date('2026-09-29T12:00:00.000Z'),
      new Date('2026-09-29T13:30:00.000Z'),
      new Date('2026-09-29T12:45:00.000Z'),
      'task',
    )
    expect(moved.startsAt.toISOString()).toBe('2026-09-29T12:45:00.000Z')
    expect(moved.endsAt.toISOString()).toBe('2026-09-29T14:15:00.000Z')
  })

  it('un recordatorio sigue siendo un instante', () => {
    const moved = movedScheduleWindow(
      new Date('2026-09-29T12:00:00.000Z'),
      new Date('2026-09-29T12:00:00.000Z'),
      new Date('2026-09-30T12:00:00.000Z'),
      'reminder',
    )
    expect(moved.startsAt.toISOString()).toBe(moved.endsAt.toISOString())
  })
})
