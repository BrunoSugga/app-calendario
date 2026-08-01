import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'

export function formatDayHeader(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
}

export function formatMonthTitle(date: Date): string {
  return format(date, "MMMM 'de' yyyy", { locale: es })
}

export function formatShortWeekday(date: Date): string {
  return format(date, 'EEEEEE', { locale: es })
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm')
}

export function dayRange(date: Date): { start: Date; end: Date } {
  return { start: startOfDay(date), end: endOfDay(date) }
}

export function weekRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  }
}

export function monthGridRange(date: Date): { start: Date; end: Date } {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  return {
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  }
}

export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = []
  let cursor = startOfDay(start)
  const last = startOfDay(end)
  while (cursor <= last) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}

export function buildMonthCells(anchor: Date): Date[] {
  const { start, end } = monthGridRange(anchor)
  return eachDay(start, end)
}

export function navigateView(date: Date, mode: 'day' | 'week' | 'month', delta: number): Date {
  if (mode === 'day') return addDays(date, delta)
  if (mode === 'week') return addDays(date, delta * 7)
  return addMonths(date, delta)
}

export { isSameDay, isSameMonth, startOfDay, endOfDay, addDays, format }
