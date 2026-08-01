import { beforeEach, describe, expect, it } from 'vitest'
import { localSignIn } from '../localStore'
import { createLocalCalendarRepository } from './localCalendarRepository'

describe('localCalendarRepository', () => {
  beforeEach(() => {
    localStorage.clear()
    localSignIn('bruno@example.com', 'Bruno')
  })

  it('crea, edita y elimina eventos de serie', async () => {
    const repo = createLocalCalendarRepository()
    let state = await repo.load()
    const calendarId = state.calendars[0].id

    state = await repo.saveEvent(state, 'user-1', {
      calendar_id: calendarId,
      title: 'Reunión',
      description: 'sync',
      starts_at: '2026-08-05T10:00:00.000Z',
      ends_at: '2026-08-05T11:00:00.000Z',
      all_day: false,
      reminder_minutes: 15,
      rrule: null,
    })
    expect(state.events).toHaveLength(1)
    expect(state.events[0].title).toBe('Reunión')

    const eventId = state.events[0].id
    state = await repo.saveEvent(state, 'user-1', {
      id: eventId,
      calendar_id: calendarId,
      title: 'Reunión editada',
      description: 'sync',
      starts_at: '2026-08-05T10:00:00.000Z',
      ends_at: '2026-08-05T11:00:00.000Z',
      all_day: false,
      reminder_minutes: 10,
      rrule: null,
      editScope: 'series',
    })
    expect(state.events[0].title).toBe('Reunión editada')
    expect(state.events[0].reminder_minutes).toBe(10)

    state = await repo.deleteEvent(state, 'user-1', eventId, 'series')
    expect(state.events).toHaveLength(0)
  })

  it('cancela una ocurrencia con excepción upsert', async () => {
    const repo = createLocalCalendarRepository()
    let state = await repo.load()
    const calendarId = state.calendars[0].id

    state = await repo.saveEvent(state, 'user-1', {
      calendar_id: calendarId,
      title: 'Daily',
      description: '',
      starts_at: '2026-08-03T10:00:00.000Z',
      ends_at: '2026-08-03T10:30:00.000Z',
      all_day: false,
      reminder_minutes: 15,
      rrule: 'FREQ=DAILY',
    })

    const eventId = state.events[0].id
    state = await repo.deleteEvent(
      state,
      'user-1',
      eventId,
      'single',
      '2026-08-04T10:00:00.000Z',
    )
    expect(state.exceptions).toHaveLength(1)
    expect(state.exceptions[0].is_cancelled).toBe(true)

    state = await repo.deleteEvent(
      state,
      'user-1',
      eventId,
      'single',
      '2026-08-04T10:00:00.000Z',
    )
    expect(state.exceptions).toHaveLength(1)
  })

  it('alterna visibilidad y calendario por defecto', async () => {
    const repo = createLocalCalendarRepository()
    let state = await repo.load()
    const firstId = state.calendars[0].id

    state = await repo.createCalendar(state, state.calendars[0].user_id, 'Trabajo', '#111111')
    expect(state.calendars).toHaveLength(2)

    const secondId = state.calendars[1].id
    state = await repo.setDefaultCalendar(state, secondId, state.calendars[0].user_id)
    expect(state.calendars.find((c) => c.id === secondId)?.is_default).toBe(true)
    expect(state.calendars.find((c) => c.id === firstId)?.is_default).toBe(false)

    state = await repo.toggleCalendarVisible(state, firstId)
    expect(state.calendars.find((c) => c.id === firstId)?.visible).toBe(false)
  })
})
