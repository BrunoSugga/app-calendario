import { describe, expect, it } from 'vitest'
import type { Calendar, CalendarEvent, EventException } from '../types'
import {
  buildRRule,
  expandOccurrences,
  jsDateToWeekdayIndex,
  labelForRRule,
  monthDayFromRRule,
  presetFromRRule,
  recurrenceEndFromRRule,
  weekdaysFromRRule,
} from './recurrence'

function calendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    id: 'cal-1',
    user_id: 'user-1',
    name: 'Personal',
    color: '#2F7FD4',
    is_default: true,
    visible: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    user_id: 'user-1',
    calendar_id: 'cal-1',
    title: 'Standup',
    description: '',
    starts_at: '2026-08-03T10:00:00.000Z',
    ends_at: '2026-08-03T10:30:00.000Z',
    all_day: false,
    reminder_minutes: 15,
    rrule: null,
    kind: 'event',
    task_status: null,
    task_started_at: null,
    task_completed_at: null,
    task_duration_ms: null,
    task_note: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('recurrence helpers', () => {
  it('jsDateToWeekdayIndex mapea domingo=6 y lunes=0', () => {
    expect(jsDateToWeekdayIndex(new Date(2026, 7, 2))).toBe(6) // domingo
    expect(jsDateToWeekdayIndex(new Date(2026, 7, 3))).toBe(0) // lunes
  })

  it('buildRRule / presetFromRRule redondean presets', () => {
    expect(buildRRule('none', new Date())).toBeNull()
    expect(presetFromRRule(null)).toBe('none')

    const daily = buildRRule('daily', new Date(2026, 7, 3, 10))
    expect(daily).toContain('FREQ=DAILY')
    expect(presetFromRRule(daily)).toBe('daily')

    const weekly = buildRRule('weekly', new Date(2026, 7, 3, 10), [0, 2])
    expect(weekly).toContain('FREQ=WEEKLY')
    expect(presetFromRRule(weekly)).toBe('weekly')
    expect(weekdaysFromRRule(weekly)).toEqual([0, 2])

    const monthly = buildRRule('monthly', new Date(2026, 7, 3, 10), [1])
    expect(monthly).toContain('FREQ=MONTHLY')
    expect(presetFromRRule(monthly)).toBe('monthly')

    const monthlyDate = buildRRule('monthly-date', new Date(2026, 7, 16, 10), [], null, 16)
    expect(monthlyDate).toContain('FREQ=MONTHLY')
    expect(monthlyDate).toContain('BYMONTHDAY=16')
    expect(presetFromRRule(monthlyDate)).toBe('monthly-date')
    expect(monthDayFromRRule(monthlyDate)).toBe(16)
  })

  it('labelForRRule describe la repetición en español', () => {
    expect(labelForRRule(null)).toBeNull()
    expect(labelForRRule(buildRRule('daily', new Date(2026, 7, 3)))).toBe('Diariamente')
    const weekly = buildRRule('weekly', new Date(2026, 7, 3), [0, 2])
    expect(labelForRRule(weekly)).toContain('Semanalmente')
    expect(labelForRRule(weekly)).toContain('Lu')
    expect(labelForRRule(weekly)).toContain('Mi')
    expect(
      labelForRRule(buildRRule('monthly-date', new Date(2026, 7, 16), [], null, 16)),
    ).toBe('Mensualmente (día 16)')
  })

  it('conserva y lee la fecha de finalización', () => {
    const until = new Date('2026-08-20T23:59:59.999Z')
    const daily = buildRRule('daily', new Date('2026-08-03T10:00:00.000Z'), [], until)
    expect(daily).toContain('UNTIL=')
    expect(
      recurrenceEndFromRRule(daily, new Date('2026-08-03T10:00:00.000Z'))?.toISOString(),
    ).toBe('2026-08-20T23:59:59.000Z')
    expect(recurrenceEndFromRRule(buildRRule('daily', new Date()), new Date())).toBeNull()
  })
})

describe('expandOccurrences', () => {
  const cal = calendar()
  const rangeStart = new Date(2026, 7, 1)
  const rangeEnd = new Date(2026, 7, 10, 23, 59, 59)

  it('incluye eventos no recurrentes dentro del rango', () => {
    const occ = expandOccurrences(
      [event({ starts_at: '2026-08-05T15:00:00.000Z', ends_at: '2026-08-05T16:00:00.000Z' })],
      [cal],
      [],
      rangeStart,
      rangeEnd,
    )
    expect(occ).toHaveLength(1)
    expect(occ[0].title).toBe('Standup')
    expect(occ[0].isRecurring).toBe(false)
  })

  it('omite calendarios no visibles', () => {
    const occ = expandOccurrences(
      [event()],
      [calendar({ visible: false })],
      [],
      rangeStart,
      rangeEnd,
    )
    expect(occ).toHaveLength(0)
  })

  it('expande series diarias y respeta cancelaciones', () => {
    const rrule = buildRRule('daily', new Date('2026-08-03T10:00:00.000Z'))
    const master = event({
      starts_at: '2026-08-03T10:00:00.000Z',
      ends_at: '2026-08-03T10:30:00.000Z',
      rrule,
    })
    const cancel: EventException = {
      id: 'ex-1',
      event_id: master.id,
      user_id: 'user-1',
      original_starts_at: '2026-08-04T10:00:00.000Z',
      is_cancelled: true,
      title: null,
      description: null,
      starts_at: null,
      ends_at: null,
      all_day: null,
      reminder_minutes: null,
      created_at: '2026-01-01T00:00:00.000Z',
    }

    const occ = expandOccurrences([master], [cal], [cancel], rangeStart, rangeEnd)
    const keys = occ.map((o) => o.originalStartsAt.toISOString())
    expect(keys).toContain('2026-08-03T10:00:00.000Z')
    expect(keys).not.toContain('2026-08-04T10:00:00.000Z')
    expect(occ.every((o) => o.isRecurring)).toBe(true)
  })

  it('aplica overrides de una ocurrencia', () => {
    const rrule = buildRRule('daily', new Date('2026-08-03T10:00:00.000Z'))
    const master = event({
      starts_at: '2026-08-03T10:00:00.000Z',
      ends_at: '2026-08-03T10:30:00.000Z',
      rrule,
    })
    const override: EventException = {
      id: 'ex-2',
      event_id: master.id,
      user_id: 'user-1',
      original_starts_at: '2026-08-05T10:00:00.000Z',
      is_cancelled: false,
      title: 'Standup movido',
      description: 'sala B',
      starts_at: '2026-08-05T11:00:00.000Z',
      ends_at: '2026-08-05T11:30:00.000Z',
      all_day: false,
      reminder_minutes: 5,
      created_at: '2026-01-01T00:00:00.000Z',
    }

    const occ = expandOccurrences([master], [cal], [override], rangeStart, rangeEnd)
    const moved = occ.find((o) => o.originalStartsAt.toISOString() === '2026-08-05T10:00:00.000Z')
    expect(moved?.title).toBe('Standup movido')
    expect(moved?.startsAt.toISOString()).toBe('2026-08-05T11:00:00.000Z')
    expect(moved?.reminderMinutes).toBe(5)
  })

  it('repite por día del mes y usa el último día en meses cortos', () => {
    const startsAt = new Date('2026-01-31T10:00:00.000Z')
    const master = event({
      starts_at: startsAt.toISOString(),
      ends_at: '2026-01-31T10:30:00.000Z',
      rrule: buildRRule('monthly-date', startsAt, [], null, 31),
    })

    const occ = expandOccurrences(
      [master],
      [cal],
      [],
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-04-30T23:59:59.999Z'),
    )

    expect(occ.map((item) => item.originalStartsAt.toISOString())).toEqual([
      '2026-01-31T10:00:00.000Z',
      '2026-02-28T10:00:00.000Z',
      '2026-03-31T10:00:00.000Z',
      '2026-04-30T10:00:00.000Z',
    ])
  })

  it('no agrega el último día cuando el día solicitado existe', () => {
    const startsAt = new Date('2026-01-30T10:00:00.000Z')
    const master = event({
      starts_at: startsAt.toISOString(),
      ends_at: '2026-01-30T10:30:00.000Z',
      rrule: buildRRule('monthly-date', startsAt, [], null, 30),
    })

    const occ = expandOccurrences(
      [master],
      [cal],
      [],
      new Date('2026-02-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.999Z'),
    )

    expect(occ.map((item) => item.originalStartsAt.toISOString())).toEqual([
      '2026-02-28T10:00:00.000Z',
      '2026-03-30T10:00:00.000Z',
    ])
  })

  it('conserva el día y la hora locales aunque DTSTART cambie de fecha en UTC', () => {
    const startsAt = new Date(2026, 0, 31, 23, 30)
    const master = event({
      starts_at: startsAt.toISOString(),
      ends_at: new Date(2026, 1, 1, 0, 0).toISOString(),
      rrule: buildRRule('monthly-date', startsAt, [], null, 31),
    })

    const occ = expandOccurrences(
      [master],
      [cal],
      [],
      new Date(2026, 0, 1),
      new Date(2026, 2, 31, 23, 59, 59, 999),
    )

    expect(occ.map((item) => [item.startsAt.getMonth(), item.startsAt.getDate()])).toEqual([
      [0, 31],
      [1, 28],
      [2, 31],
    ])
    expect(occ.every((item) => item.startsAt.getHours() === 23)).toBe(true)
    expect(occ.every((item) => item.startsAt.getMinutes() === 30)).toBe(true)
  })

  it('respeta UNTIL y excepciones en ocurrencias ajustadas al último día', () => {
    const startsAt = new Date('2026-01-31T10:00:00.000Z')
    const master = event({
      starts_at: startsAt.toISOString(),
      ends_at: '2026-01-31T10:30:00.000Z',
      rrule: buildRRule(
        'monthly-date',
        startsAt,
        [],
        new Date('2026-03-15T23:59:59.000Z'),
        31,
      ),
    })
    const cancel: EventException = {
      id: 'ex-monthly-date',
      event_id: master.id,
      user_id: 'user-1',
      original_starts_at: '2026-02-28T10:00:00.000Z',
      is_cancelled: true,
      title: null,
      description: null,
      starts_at: null,
      ends_at: null,
      all_day: null,
      reminder_minutes: null,
      created_at: '2026-01-01T00:00:00.000Z',
    }

    const occ = expandOccurrences(
      [master],
      [cal],
      [cancel],
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-04-30T23:59:59.999Z'),
    )

    expect(occ.map((item) => item.originalStartsAt.toISOString())).toEqual([
      '2026-01-31T10:00:00.000Z',
    ])
  })

  it('ordena por hora de inicio', () => {
    const occ = expandOccurrences(
      [
        event({
          id: 'a',
          starts_at: '2026-08-05T14:00:00.000Z',
          ends_at: '2026-08-05T15:00:00.000Z',
          title: 'Tarde',
        }),
        event({
          id: 'b',
          starts_at: '2026-08-05T09:00:00.000Z',
          ends_at: '2026-08-05T10:00:00.000Z',
          title: 'Mañana',
        }),
      ],
      [cal],
      [],
      rangeStart,
      rangeEnd,
    )
    expect(occ.map((o) => o.title)).toEqual(['Mañana', 'Tarde'])
  })
})
