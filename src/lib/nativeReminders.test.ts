import { addMinutes } from 'date-fns'
import { describe, expect, it } from 'vitest'
import type { Occurrence } from '../types'
import {
  NATIVE_REMINDER_MAX,
  notificationIdFromFireKey,
  parseNotificationExtra,
  persistFiredKey,
  scheduleFromOccurrences,
} from './nativeReminders'

function occ(partial: Partial<Occurrence> & { eventId: string; startsAt: Date }): Occurrence {
  const startsAt = partial.startsAt
  return {
    eventId: partial.eventId,
    calendarId: partial.calendarId ?? 'cal-1',
    title: partial.title ?? 'Reunión',
    description: partial.description ?? 'secreto interno',
    startsAt,
    endsAt: partial.endsAt ?? addMinutes(startsAt, 60),
    allDay: false,
    reminderMinutes: partial.reminderMinutes ?? 0,
    color: '#2F7FD4',
    isRecurring: false,
    originalStartsAt: partial.originalStartsAt ?? startsAt,
    kind: partial.kind ?? 'event',
    taskStatus: null,
  }
}

const now = new Date('2026-08-14T10:00:00.000Z')

describe('native reminder schedule', () => {
  it('programa futuros, omite descripción y recorta el lote', () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      occ({
        eventId: `evt-${i + 1}`,
        startsAt: addMinutes(now, 30 + i),
        title: `Evento ${i}`,
        description: '<script>alert(1)</script>',
      }),
    )
    const items = scheduleFromOccurrences(many, {
      now,
      calendars: [{ id: 'cal-1', name: 'Trabajo' }],
    })
    expect(items.length).toBe(NATIVE_REMINDER_MAX)
    expect(items.every((item) => item.at.getTime() > now.getTime())).toBe(true)
    expect(items[0]?.body).not.toMatch(/script|secreto|alert/i)
    expect(items[0]?.body).toContain('Trabajo')
    expect(items[0]?.extra).not.toHaveProperty('description')
    const id = notificationIdFromFireKey(items[0]!.fireKey)
    expect(id).toBeGreaterThan(0)
    expect(id).toBeLessThanOrEqual(2147483646)
    expect(Number.isInteger(id)).toBe(true)
    expect(notificationIdFromFireKey(items[0]!.fireKey)).toBe(id)
  })

  it('difiere avisos del calendario laboral fuera de jornada', () => {
    const thursdayEvening = new Date('2026-08-06T18:00:00')
    const items = scheduleFromOccurrences(
      [
        occ({
          eventId: 'work-1',
          calendarId: 'work',
          startsAt: thursdayEvening,
          reminderMinutes: 0,
          title: 'Cierre',
        }),
      ],
      {
        now: new Date('2026-08-06T12:00:00'),
        calendars: [{ id: 'work', name: 'Laboral' }],
        workWeek: {
          workCalendarId: 'work',
          workDays: [1, 2, 3, 4, 5],
          startMinute: 8 * 60,
          endMinute: 17 * 60,
          muteOutsideHours: true,
        },
      },
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.at.getDay()).toBe(5) // viernes
    expect(items[0]?.at.getHours()).toBe(8)
  })

  it('parseNotificationExtra rechaza ids/ISO inválidos y acepta extras limpios', () => {
    expect(parseNotificationExtra(null)).toBeNull()
    expect(
      parseNotificationExtra({
        eventId: '../x',
        startsAt: '2026-08-14T10:00:00.000Z',
        originalStartsAt: '2026-08-14T10:00:00.000Z',
      }),
    ).toBeNull()
    expect(
      parseNotificationExtra({
        eventId: 'evt-1',
        startsAt: 'not-a-date',
        originalStartsAt: '2026-08-14T10:00:00.000Z',
      }),
    ).toBeNull()
    expect(
      parseNotificationExtra({
        eventId: 'evt-1',
        startsAt: '2026-08-14T10:00:00.000Z',
      }),
    ).toMatchObject({
      eventId: 'evt-1',
      startsAt: '2026-08-14T10:00:00.000Z',
      originalStartsAt: '2026-08-14T10:00:00.000Z',
    })
    const dirty = parseNotificationExtra({
      eventId: 'evt-1',
      startsAt: '2026-08-14T10:00:00.000Z',
      originalStartsAt: '2026-08-14T10:00:00.000Z',
      title: '<b>Hola</b> javascript:alert(1)',
      timeLabel: '10:00',
      calendarName: 'Lab',
    })
    expect(dirty?.title).not.toMatch(/<|>|javascript:/i)
  })

  it('persistFiredKey acumula keys en localStorage', () => {
    localStorage.removeItem('calendario.reminders.fired')
    persistFiredKey('evt-1:2026-08-14T10:00:00.000Z')
    persistFiredKey('evt-2:2026-08-14T11:00:00.000Z')
    const stored = JSON.parse(localStorage.getItem('calendario.reminders.fired') ?? '[]') as string[]
    expect(stored).toContain('evt-1:2026-08-14T10:00:00.000Z')
    expect(stored).toContain('evt-2:2026-08-14T11:00:00.000Z')
  })
})
