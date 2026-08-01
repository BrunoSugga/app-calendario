import { describe, expect, it } from 'vitest'
import {
  buildMonthCells,
  dayRange,
  eachDay,
  formatTime,
  monthGridRange,
  navigateView,
  weekRange,
} from './dates'

describe('dates', () => {
  it('dayRange cubre el día completo', () => {
    const { start, end } = dayRange(new Date(2026, 7, 1, 15, 30))
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
  })

  it('weekRange empieza en lunes', () => {
    // sábado 1 ago 2026 → lunes 27 jul
    const { start, end } = weekRange(new Date(2026, 7, 1))
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(27)
    expect(end.getDay()).toBe(0)
    expect(end.getDate()).toBe(2)
  })

  it('monthGridRange incluye días de meses vecinos', () => {
    const { start, end } = monthGridRange(new Date(2026, 7, 15))
    expect(start.getDay()).toBe(1)
    expect(end.getDay()).toBe(0)
    expect(start.getTime()).toBeLessThan(new Date(2026, 7, 1).getTime())
  })

  it('eachDay genera días inclusivos', () => {
    const days = eachDay(new Date(2026, 7, 1), new Date(2026, 7, 3))
    expect(days).toHaveLength(3)
    expect(days[0].getDate()).toBe(1)
    expect(days[2].getDate()).toBe(3)
  })

  it('buildMonthCells genera grilla de 5 o 6 semanas', () => {
    const cells = buildMonthCells(new Date(2026, 7, 1))
    expect(cells.length % 7).toBe(0)
    expect(cells.length).toBeGreaterThanOrEqual(35)
    expect(cells.length).toBeLessThanOrEqual(42)
  })

  it('navigateView avanza por día, semana y mes', () => {
    const base = new Date(2026, 7, 1)
    expect(navigateView(base, 'day', 1).getDate()).toBe(2)
    expect(navigateView(base, 'week', 1).getDate()).toBe(8)
    expect(navigateView(base, 'month', 1).getMonth()).toBe(8)
  })

  it('formatTime usa HH:mm', () => {
    expect(formatTime(new Date(2026, 7, 1, 9, 5))).toBe('09:05')
  })
})
