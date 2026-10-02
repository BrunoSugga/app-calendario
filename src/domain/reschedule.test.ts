import { describe, expect, it } from 'vitest'
import { movedScheduleWindow, withReagendadoPrefix } from './reschedule'

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
