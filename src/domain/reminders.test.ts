import { describe, expect, it } from 'vitest'
import { addMinutes } from 'date-fns'
import type { Occurrence } from '../types'
import {
  isOccurrenceDueForReminder,
  reminderFireKey,
  reminderScanRange,
  selectDueReminders,
} from './reminders'

function occ(overrides: Partial<Occurrence> = {}): Occurrence {
  const startsAt = overrides.startsAt ?? new Date('2026-08-08T13:17:00.000-03:00')
  return {
    eventId: 'evt-1',
    calendarId: 'cal-1',
    title: 'Prueba',
    description: '',
    startsAt,
    endsAt: overrides.endsAt ?? startsAt,
    allDay: false,
    reminderMinutes: 0,
    color: '#2F7FD4',
    isRecurring: false,
    originalStartsAt: startsAt,
    kind: 'reminder',
    taskStatus: null,
    ...overrides,
  }
}

describe('reminderScanRange', () => {
  it('mira unos minutos atrás para no perder recordatorios de duración 0', () => {
    const now = new Date('2026-08-08T13:17:10.000-03:00')
    const range = reminderScanRange(now, 5, 24)
    expect(range.start.getTime()).toBe(addMinutes(now, -5).getTime())
    expect(range.end.getTime()).toBe(addMinutes(now, 24 * 60).getTime())
  })
})

describe('isOccurrenceDueForReminder', () => {
  it('dispara al inicio (aviso 0) dentro de la gracia', () => {
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const now = new Date('2026-08-08T13:17:20.000-03:00')
    expect(
      isOccurrenceDueForReminder(occ({ startsAt, endsAt: startsAt, reminderMinutes: 0 }), now),
    ).toBe(true)
  })

  it('no dispara si ya pasó la gracia', () => {
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const now = new Date('2026-08-08T13:23:00.000-03:00')
    expect(
      isOccurrenceDueForReminder(occ({ startsAt, endsAt: startsAt, reminderMinutes: 0 }), now),
    ).toBe(false)
  })

  it('dispara N minutos antes', () => {
    const startsAt = new Date('2026-08-08T14:00:00.000-03:00')
    const now = new Date('2026-08-08T13:45:00.000-03:00')
    expect(isOccurrenceDueForReminder(occ({ startsAt, reminderMinutes: 15 }), now)).toBe(true)
    expect(
      isOccurrenceDueForReminder(
        occ({ startsAt, reminderMinutes: 15 }),
        new Date('2026-08-08T13:44:00.000-03:00'),
      ),
    ).toBe(false)
  })

  it('respeta snooze activo', () => {
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const now = new Date('2026-08-08T13:17:10.000-03:00')
    expect(
      isOccurrenceDueForReminder(occ({ startsAt, reminderMinutes: 0 }), now, {
        snoozeActive: () => true,
      }),
    ).toBe(false)
  })
})

describe('selectDueReminders', () => {
  it('omite keys ya disparadas', () => {
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const item = occ({ startsAt, endsAt: startsAt, reminderMinutes: 0 })
    const now = new Date('2026-08-08T13:17:10.000-03:00')
    const fired = new Set([reminderFireKey(item.eventId, item.originalStartsAt)])
    expect(selectDueReminders([item], now, fired)).toEqual([])
    expect(selectDueReminders([item], now, new Set()).map((o) => o.eventId)).toEqual(['evt-1'])
  })
})

describe('pipeline expand + due (regresión recordatorio duración 0)', () => {
  it('el rango de scan incluye un reminder que empezó hace segundos', async () => {
    const { expandOccurrences } = await import('./recurrence')
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const now = new Date('2026-08-08T13:17:10.000-03:00')
    const range = reminderScanRange(now)

    const events = [
      {
        id: 'evt-1',
        user_id: 'u1',
        calendar_id: 'cal-1',
        title: 'Prueba',
        description: '',
        starts_at: startsAt.toISOString(),
        ends_at: startsAt.toISOString(),
        all_day: false,
        reminder_minutes: 0,
        rrule: null,
        kind: 'reminder' as const,
        task_status: null,
        task_started_at: null,
        task_completed_at: null,
        task_duration_ms: null,
        task_note: null,
        created_at: startsAt.toISOString(),
        updated_at: startsAt.toISOString(),
      },
    ]
    const calendars = [
      {
        id: 'cal-1',
        user_id: 'u1',
        name: 'Personal',
        color: '#2F7FD4',
        is_default: true,
        visible: true,
        created_at: startsAt.toISOString(),
      },
    ]

    // Bug viejo: rangeStart=now excluía ends_at < now
    const broken = expandOccurrences(events, calendars, [], now, range.end)
    expect(broken).toHaveLength(0)

    const fixed = expandOccurrences(events, calendars, [], range.start, range.end)
    expect(fixed).toHaveLength(1)
    expect(selectDueReminders(fixed, now, new Set()).map((o) => o.eventId)).toEqual(['evt-1'])
  })
})
