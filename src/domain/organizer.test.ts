import { describe, expect, it } from 'vitest'
import type { Calendar, CalendarEvent, EventException } from '../types'
import { buildOrganizerItems } from './organizer'
import { buildRRule } from './recurrence'

const calendar: Calendar = {
  id: 'cal-1',
  user_id: 'user-1',
  name: 'Personal',
  color: '#2F7FD4',
  is_default: true,
  visible: true,
  created_at: '2026-01-01T00:00:00.000Z',
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    user_id: 'user-1',
    calendar_id: calendar.id,
    title: 'Evento',
    description: '',
    starts_at: '2026-08-20T13:00:00.000Z',
    ends_at: '2026-08-20T14:00:00.000Z',
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

function exception(overrides: Partial<EventException>): EventException {
  return {
    id: 'ex-1',
    event_id: 'evt-1',
    user_id: 'user-1',
    original_starts_at: '2026-08-16T13:00:00.000Z',
    is_cancelled: false,
    title: null,
    description: null,
    starts_at: null,
    ends_at: null,
    all_day: null,
    reminder_minutes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const now = new Date('2026-08-15T16:00:00.000Z')
const pastSince = new Date('2026-05-17T16:00:00.000Z')
const upcomingUntil = new Date('2026-11-13T16:00:00.000Z')

describe('buildOrganizerItems', () => {
  it('ordena eventos futuros e incluye eventos en curso', () => {
    const result = buildOrganizerItems(
      [
        event({ id: 'later' }),
        event({
          id: 'current',
          title: 'En curso',
          starts_at: '2026-08-15T15:30:00.000Z',
          ends_at: '2026-08-15T16:30:00.000Z',
        }),
      ],
      [calendar],
      [],
      now,
      pastSince,
      upcomingUntil,
    )

    expect(result.upcoming.map((item) => item.master.id)).toEqual(['current', 'later'])
  })

  it('lista cada repetición futura y omite el día cancelado', () => {
    const recurring = event({
      starts_at: '2026-08-14T13:00:00.000Z',
      ends_at: '2026-08-14T14:00:00.000Z',
      rrule: buildRRule('daily', new Date('2026-08-14T13:00:00.000Z')),
    })
    const cancelled = exception({
      original_starts_at: '2026-08-16T13:00:00.000Z',
      is_cancelled: true,
    })

    const result = buildOrganizerItems(
      [recurring],
      [calendar],
      [cancelled],
      now,
      pastSince,
      new Date('2026-08-20T16:00:00.000Z'),
    )

    expect(result.upcoming.map((item) => item.occurrence.originalStartsAt.toISOString())).toEqual([
      '2026-08-17T13:00:00.000Z',
      '2026-08-18T13:00:00.000Z',
      '2026-08-19T13:00:00.000Z',
      '2026-08-20T13:00:00.000Z',
    ])
    expect(result.past.map((item) => item.occurrence.originalStartsAt.toISOString())).toEqual([
      '2026-08-15T13:00:00.000Z',
      '2026-08-14T13:00:00.000Z',
    ])
    expect(result.upcoming[0].recurrenceEndsAt).toBeNull()
  })

  it('lista lunes, miércoles y viernes de un recordatorio semanal', () => {
    const startsAt = new Date('2026-11-09T12:00:00.000Z')
    const recurring = event({
      title: 'Facturar Polakof',
      kind: 'reminder',
      reminder_minutes: 0,
      starts_at: startsAt.toISOString(),
      ends_at: startsAt.toISOString(),
      rrule: buildRRule('weekly', startsAt, [0, 2, 4], new Date('2026-11-29T23:59:59.999Z')),
    })

    const result = buildOrganizerItems(
      [recurring],
      [calendar],
      [],
      new Date('2026-11-06T19:28:00.000Z'),
      new Date('2026-08-08T19:28:00.000Z'),
      new Date('2027-02-04T19:28:00.000Z'),
    )

    expect(result.upcoming.map((item) => item.occurrence.startsAt.toISOString())).toEqual([
      '2026-11-09T12:00:00.000Z',
      '2026-11-11T12:00:00.000Z',
      '2026-11-13T12:00:00.000Z',
      '2026-11-16T12:00:00.000Z',
      '2026-11-18T12:00:00.000Z',
      '2026-11-20T12:00:00.000Z',
      '2026-11-23T12:00:00.000Z',
      '2026-11-25T12:00:00.000Z',
      '2026-11-27T12:00:00.000Z',
    ])
  })

  it('incluye la ocurrencia reprogramada en el día al que se movió', () => {
    const recurring = event({
      starts_at: '2026-08-10T13:00:00.000Z',
      ends_at: '2026-08-10T14:00:00.000Z',
      rrule: buildRRule('weekly', new Date('2026-08-10T13:00:00.000Z'), [0]),
    })
    const moved = exception({
      original_starts_at: '2026-08-10T13:00:00.000Z',
      title: 'Movido',
      starts_at: '2026-08-16T13:00:00.000Z',
      ends_at: '2026-08-16T14:00:00.000Z',
    })

    const result = buildOrganizerItems(
      [recurring],
      [calendar],
      [moved],
      now,
      pastSince,
      new Date('2026-08-24T16:00:00.000Z'),
    )

    expect(result.upcoming[0].occurrence.title).toBe('Movido')
    expect(result.upcoming.map((item) => item.occurrence.startsAt.toISOString())).toEqual([
      '2026-08-16T13:00:00.000Z',
      '2026-08-17T13:00:00.000Z',
      '2026-08-24T13:00:00.000Z',
    ])
    expect(result.upcoming[0].occurrence.originalStartsAt.toISOString()).toBe('2026-08-10T13:00:00.000Z')
    expect(
      result.upcoming.some((item) => item.occurrence.startsAt.toISOString() === '2026-08-10T13:00:00.000Z'),
    ).toBe(false)
  })

  it('muestra cada día de una serie ya terminada', () => {
    const recurring = event({
      starts_at: '2026-08-10T13:00:00.000Z',
      ends_at: '2026-08-10T14:00:00.000Z',
      rrule: buildRRule(
        'daily',
        new Date('2026-08-10T13:00:00.000Z'),
        [],
        new Date('2026-08-12T13:00:00.000Z'),
      ),
    })

    const result = buildOrganizerItems([recurring], [calendar], [], now, pastSince, upcomingUntil)

    expect(result.upcoming).toHaveLength(0)
    expect(result.past.map((item) => item.occurrence.startsAt.toISOString())).toEqual([
      '2026-08-12T13:00:00.000Z',
      '2026-08-11T13:00:00.000Z',
      '2026-08-10T13:00:00.000Z',
    ])
    expect(result.past[0].recurrenceEndsAt?.toISOString()).toBe('2026-08-12T13:00:00.000Z')
  })

  it('conserva un evento único y la próxima de una serie que empiezan después del rango', () => {
    const later = event({
      id: 'later',
      starts_at: '2027-03-01T13:00:00.000Z',
      ends_at: '2027-03-01T14:00:00.000Z',
    })
    const series = event({
      id: 'series',
      starts_at: '2027-01-04T13:00:00.000Z',
      ends_at: '2027-01-04T14:00:00.000Z',
      rrule: buildRRule('weekly', new Date('2027-01-04T13:00:00.000Z'), [0]),
    })
    const shortWindow = new Date('2026-09-01T16:00:00.000Z')

    const single = buildOrganizerItems([later], [calendar], [], now, pastSince, shortWindow)
    const recurring = buildOrganizerItems([series], [calendar], [], now, pastSince, shortWindow)

    expect(single.upcoming).toHaveLength(1)
    expect(single.upcoming[0].occurrence.startsAt.toISOString()).toBe('2027-03-01T13:00:00.000Z')
    expect(recurring.upcoming).toHaveLength(1)
    expect(recurring.upcoming[0].occurrence.startsAt.toISOString()).toBe('2027-01-04T13:00:00.000Z')
  })

  it('respeta el rango anterior y la visibilidad del calendario', () => {
    const old = event({
      starts_at: '2026-01-01T13:00:00.000Z',
      ends_at: '2026-01-01T14:00:00.000Z',
    })
    expect(buildOrganizerItems([old], [calendar], [], now, pastSince, upcomingUntil).past).toHaveLength(0)
    expect(
      buildOrganizerItems([event()], [{ ...calendar, visible: false }], [], now, pastSince, upcomingUntil)
        .upcoming,
    ).toHaveLength(0)
  })
})
