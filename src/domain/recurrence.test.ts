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

  it('muestra un aplazamiento cuyo horario original quedó fuera del rango', () => {
    const rrule = buildRRule('daily', new Date('2026-08-03T10:00:00.000Z'))
    const master = event({
      starts_at: '2026-08-03T10:00:00.000Z',
      ends_at: '2026-08-03T11:00:00.000Z',
      rrule,
      kind: 'task',
    })
    const override: EventException = {
      id: 'ex-moved',
      event_id: master.id,
      user_id: 'user-1',
      original_starts_at: '2026-08-05T10:00:00.000Z',
      is_cancelled: false,
      title: null,
      description: null,
      starts_at: '2026-08-05T16:00:00.000Z',
      ends_at: '2026-08-05T17:00:00.000Z',
      all_day: null,
      reminder_minutes: null,
      created_at: '2026-08-05T10:00:00.000Z',
    }

    const later = expandOccurrences(
      [master],
      [cal],
      [override],
      new Date('2026-08-05T15:00:00.000Z'),
      new Date('2026-08-05T18:00:00.000Z'),
    )
    expect(later).toHaveLength(1)
    expect(later[0].startsAt.toISOString()).toBe('2026-08-05T16:00:00.000Z')
    expect(later[0].endsAt.toISOString()).toBe('2026-08-05T17:00:00.000Z')
    expect(later[0].originalStartsAt.toISOString()).toBe('2026-08-05T10:00:00.000Z')

    const wide = expandOccurrences([master], [cal], [override], rangeStart, rangeEnd)
    const sameOriginal = wide.filter(
      (item) => item.originalStartsAt.toISOString() === '2026-08-05T10:00:00.000Z',
    )
    expect(sameOriginal).toHaveLength(1)
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

  it('una tarea no periódica terminada sigue terminada', () => {
    const occ = expandOccurrences(
      [
        event({
          kind: 'task',
          title: 'Informe único',
          starts_at: '2026-08-05T15:00:00.000Z',
          ends_at: '2026-08-05T16:00:00.000Z',
          task_status: 'done',
          task_started_at: '2026-08-05T15:05:00.000Z',
          task_completed_at: '2026-08-05T15:40:00.000Z',
        }),
      ],
      [cal],
      [],
      rangeStart,
      rangeEnd,
    )
    expect(occ).toHaveLength(1)
    expect(occ[0].taskStatus).toBe('done')
  })

  it('en una serie, Terminada solo pinta la repetición de esa corrida', () => {
    const startsAt = new Date('2026-10-11T15:10:00.000Z')
    const master = event({
      kind: 'task',
      title: 'INFORME: PROMOCIONES',
      starts_at: startsAt.toISOString(),
      ends_at: '2026-10-11T15:40:00.000Z',
      rrule: buildRRule('daily', startsAt),
      task_status: 'done',
      task_started_at: '2026-10-11T15:12:00.000Z',
      task_completed_at: '2026-10-11T15:35:00.000Z',
    })

    const occ = expandOccurrences(
      [master],
      [cal],
      [],
      new Date('2026-10-11T00:00:00.000Z'),
      new Date('2026-10-13T23:59:59.999Z'),
    )
    const statusByStart = new Map(occ.map((item) => [item.startsAt.toISOString(), item.taskStatus]))
    expect(statusByStart.get('2026-10-11T15:10:00.000Z')).toBe('done')
    expect(statusByStart.get('2026-10-12T15:10:00.000Z')).toBe('pending')
    expect(statusByStart.get('2026-10-13T15:10:00.000Z')).toBe('pending')
  })

  it('en hora local, el día siguiente no hereda Terminada', () => {
    const start = new Date(2026, 9, 11, 12, 10, 0, 0)
    const end = new Date(2026, 9, 11, 12, 40, 0, 0)
    const master = event({
      kind: 'task',
      title: 'INFORME: PROMOCIONES',
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      rrule: buildRRule('daily', start),
      task_status: 'done',
      task_started_at: new Date(2026, 9, 11, 12, 12, 0, 0).toISOString(),
      task_completed_at: new Date(2026, 9, 11, 12, 40, 0, 0).toISOString(),
    })

    const occ = expandOccurrences(
      [master],
      [cal],
      [],
      new Date(2026, 9, 11, 0, 0, 0, 0),
      new Date(2026, 9, 13, 23, 59, 59, 999),
    )
    const byDay = new Map(occ.map((item) => [item.startsAt.getDate(), item.taskStatus]))
    expect(byDay.get(11)).toBe('done')
    expect(byDay.get(12)).toBe('pending')
    expect(byDay.get(13)).toBe('pending')
    expect(occ.find((item) => item.startsAt.getDate() === 11)?.startsAt.getHours()).toBe(12)
    expect(occ.find((item) => item.startsAt.getDate() === 11)?.startsAt.getMinutes()).toBe(10)
  })

  it('cerrar justo al fin, o un instante después, no marca la repetición siguiente', () => {
    const startsAt = new Date('2026-10-11T15:10:00.000Z')
    const endsAt = new Date('2026-10-11T15:40:00.000Z')
    const base = event({
      kind: 'task',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      rrule: buildRRule('daily', startsAt),
      task_status: 'done',
      task_started_at: '2026-10-11T15:12:00.000Z',
    })

    for (const completedAt of ['2026-10-11T15:40:00.000Z', '2026-10-11T15:40:00.001Z']) {
      const occ = expandOccurrences(
        [event({ ...base, id: completedAt, task_completed_at: completedAt })],
        [cal],
        [],
        new Date('2026-10-11T00:00:00.000Z'),
        new Date('2026-10-12T23:59:59.999Z'),
      )
      expect(occ.find((item) => item.startsAt.toISOString() === startsAt.toISOString())?.taskStatus).toBe(
        'done',
      )
      expect(
        occ.find((item) => item.startsAt.toISOString() === '2026-10-12T15:10:00.000Z')?.taskStatus,
      ).toBe('pending')
    }
  })

  it('en curso solo la corrida abierta; la repetición posterior queda pendiente', () => {
    const startsAt = new Date('2026-10-11T15:10:00.000Z')
    const master = event({
      kind: 'task',
      starts_at: startsAt.toISOString(),
      ends_at: '2026-10-11T15:40:00.000Z',
      rrule: buildRRule('daily', startsAt),
      task_status: 'in_progress',
      task_started_at: '2026-10-12T15:05:00.000Z',
      task_completed_at: null,
    })
    const occ = expandOccurrences(
      [master],
      [cal],
      [],
      new Date('2026-10-11T00:00:00.000Z'),
      new Date('2026-10-13T23:59:59.999Z'),
    )
    const statusByStart = new Map(occ.map((item) => [item.startsAt.toISOString(), item.taskStatus]))
    expect(statusByStart.get('2026-10-11T15:10:00.000Z')).toBe('pending')
    expect(statusByStart.get('2026-10-12T15:10:00.000Z')).toBe('in_progress')
    expect(statusByStart.get('2026-10-13T15:10:00.000Z')).toBe('pending')
  })

  it('un aplazamiento no hace que la repetición nueva herede el cierre anterior', () => {
    const startsAt = new Date('2026-10-11T15:10:00.000Z')
    const master = event({
      kind: 'task',
      title: 'INFORME: PROMOCIONES',
      starts_at: startsAt.toISOString(),
      ends_at: '2026-10-11T15:40:00.000Z',
      rrule: buildRRule('daily', startsAt),
      task_status: 'done',
      task_started_at: '2026-10-11T15:12:00.000Z',
      task_completed_at: '2026-10-11T15:35:00.000Z',
    })
    const moved: EventException = {
      id: 'ex-promo',
      event_id: master.id,
      user_id: 'user-1',
      original_starts_at: '2026-10-12T15:10:00.000Z',
      is_cancelled: false,
      title: null,
      description: null,
      starts_at: '2026-10-12T18:10:00.000Z',
      ends_at: '2026-10-12T18:40:00.000Z',
      all_day: null,
      reminder_minutes: null,
      created_at: '2026-10-12T15:00:00.000Z',
    }
    const occ = expandOccurrences(
      [master],
      [cal],
      [moved],
      new Date('2026-10-11T00:00:00.000Z'),
      new Date('2026-10-12T23:59:59.999Z'),
    )
    const previous = occ.find((item) => item.startsAt.toISOString() === '2026-10-11T15:10:00.000Z')
    const current = occ.find((item) => item.originalStartsAt.toISOString() === '2026-10-12T15:10:00.000Z')
    expect(previous?.taskStatus).toBe('done')
    expect(current?.startsAt.toISOString()).toBe('2026-10-12T18:10:00.000Z')
    expect(current?.taskStatus).toBe('pending')
  })

  it('empezar antes del bloque aplazado marca esa ocurrencia en curso', () => {
    const startsAt = new Date('2026-10-12T15:10:00.000Z')
    const master = event({
      kind: 'task',
      starts_at: startsAt.toISOString(),
      ends_at: '2026-10-12T15:40:00.000Z',
      rrule: buildRRule('daily', startsAt),
      task_status: 'in_progress',
      task_started_at: '2026-10-12T18:00:00.000Z',
      task_completed_at: null,
    })
    const moved: EventException = {
      id: 'ex-open',
      event_id: master.id,
      user_id: 'user-1',
      original_starts_at: '2026-10-12T15:10:00.000Z',
      is_cancelled: false,
      title: null,
      description: null,
      starts_at: '2026-10-12T18:10:00.000Z',
      ends_at: '2026-10-12T18:40:00.000Z',
      all_day: null,
      reminder_minutes: null,
      created_at: '2026-10-12T15:00:00.000Z',
    }
    const occ = expandOccurrences(
      [master],
      [cal],
      [moved],
      new Date('2026-10-12T00:00:00.000Z'),
      new Date('2026-10-13T23:59:59.999Z'),
    )
    const current = occ.find((item) => item.originalStartsAt.toISOString() === '2026-10-12T15:10:00.000Z')
    const next = occ.find((item) => item.startsAt.toISOString() === '2026-10-13T15:10:00.000Z')
    expect(current?.taskStatus).toBe('in_progress')
    expect(next?.taskStatus).toBe('pending')
  })

  it('una serie terminada sin ancla de corrida no pinta todas las repeticiones', () => {
    const startsAt = new Date('2026-10-11T15:10:00.000Z')
    const master = event({
      kind: 'task',
      starts_at: startsAt.toISOString(),
      ends_at: '2026-10-11T15:40:00.000Z',
      rrule: buildRRule('daily', startsAt),
      task_status: 'done',
      task_started_at: 'no-es-fecha',
      task_completed_at: null,
    })
    const occ = expandOccurrences(
      [master],
      [cal],
      [],
      new Date('2026-10-11T00:00:00.000Z'),
      new Date('2026-10-12T23:59:59.999Z'),
    )
    expect(occ.length).toBeGreaterThan(0)
    expect(occ.every((item) => item.taskStatus === 'pending')).toBe(true)
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
