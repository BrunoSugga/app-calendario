import { beforeEach, describe, expect, it } from 'vitest'
import {
  consumeQueuedCompleteTask,
  consumeQueuedExtendTaskEnd,
  consumeQueuedOpenEvent,
  consumeQueuedRescheduleEvent,
  consumeQueuedStartTask,
  consumeQueuedTaskEndClosed,
  consumeReminderPayload,
  consumeTaskEndPayload,
  loadReminderWindowPayload,
  loadTaskEndWindowPayload,
  releaseReminderWindowPayload,
  releaseTaskEndWindowPayload,
  queueCompleteTask,
  queueExtendTaskEnd,
  queueOpenEvent,
  queueRescheduleEvent,
  queueStartTask,
  queueTaskEndClosed,
  storeReminderPayload,
  storeTaskEndPayload,
} from './tauri'

describe('reminder payload / bridges', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('guarda y consume payload con kind, startsAt y originalStartsAt', () => {
    const token = storeReminderPayload({
      title: 'Tarea',
      timeLabel: '10:00',
      calendarName: 'Personal',
      description: 'desc',
      eventId: 'evt-1',
      kind: 'task',
      startsAt: '2026-08-05T10:00:00.000Z',
      originalStartsAt: '2026-08-05T10:00:00.000Z',
      reminderMinutes: 15,
    })
    const data = consumeReminderPayload(token)
    expect(data?.kind).toBe('task')
    expect(data?.eventId).toBe('evt-1')
    expect(data?.startsAt).toBe('2026-08-05T10:00:00.000Z')
    expect(data?.originalStartsAt).toBe('2026-08-05T10:00:00.000Z')
    expect(data?.reminderMinutes).toBe(15)
    expect(consumeReminderPayload(token)).toBeNull()
  })

  it('sobrevive a una recarga de la misma ventana y no se reabre en otra', () => {
    const token = storeReminderPayload({
      title: 'Bocata',
      timeLabel: '09:25',
      calendarName: 'Personal',
      description: '',
      eventId: 'evt-1',
      kind: 'reminder',
      startsAt: '2026-08-05T12:25:00.000Z',
      originalStartsAt: '2026-08-05T12:25:00.000Z',
      reminderMinutes: 0,
    })

    expect(loadReminderWindowPayload(token)?.title).toBe('Bocata')
    expect(localStorage.getItem(`calendario.reminder.payload.${token}`)).toBeNull()
    expect(loadReminderWindowPayload(token)?.title).toBe('Bocata')

    sessionStorage.clear()
    expect(loadReminderWindowPayload(token)).toBeNull()
  })

  it('rechaza token hostil, aviso vencido y session manipulada', () => {
    expect(loadReminderWindowPayload('../etc')).toBeNull()
    expect(loadReminderWindowPayload('<script>')).toBeNull()

    const expired = storeReminderPayload({
      title: 'Viejo',
      timeLabel: '09:25',
      calendarName: 'Personal',
      description: '',
      eventId: 'evt-1',
      kind: 'reminder',
      startsAt: '2026-08-05T12:25:00.000Z',
      originalStartsAt: '2026-08-05T12:25:00.000Z',
    })
    const stored = JSON.parse(localStorage.getItem(`calendario.reminder.payload.${expired}`) ?? 'null') as {
      exp: number
    }
    stored.exp = Date.now() - 1000
    localStorage.setItem(`calendario.reminder.payload.${expired}`, JSON.stringify(stored))
    expect(loadReminderWindowPayload(expired)).toBeNull()

    const token = storeReminderPayload({
      title: 'Bocata',
      timeLabel: '09:25',
      calendarName: 'Personal',
      description: '',
      eventId: 'evt-1',
      kind: 'reminder',
      startsAt: '2026-08-05T12:25:00.000Z',
      originalStartsAt: '2026-08-05T12:25:00.000Z',
    })
    expect(loadReminderWindowPayload(token)?.eventId).toBe('evt-1')
    sessionStorage.setItem(
      `calendario.reminder.session.${token}`,
      JSON.stringify({
        eventId: '<script>',
        title: 'x',
        timeLabel: '09:25',
        calendarName: 'Personal',
        description: '',
        kind: 'reminder',
        startsAt: '2026-08-05T12:25:00.000Z',
        originalStartsAt: '2026-08-05T12:25:00.000Z',
        reminderMinutes: 0,
        exp: Date.now() + 60_000,
      }),
    )
    expect(loadReminderWindowPayload(token)).toBeNull()
    releaseReminderWindowPayload('<script>')
  })

  it('usa startsAt como originalStartsAt si falta', () => {
    const token = storeReminderPayload({
      title: 'Evento',
      timeLabel: '11:00',
      calendarName: 'Personal',
      description: '',
      eventId: 'evt-2',
      kind: 'event',
      startsAt: '2026-08-05T11:00:00.000Z',
      originalStartsAt: '',
    })
    const data = consumeReminderPayload(token)
    expect(data?.originalStartsAt).toBe('2026-08-05T11:00:00.000Z')
  })

  it('encola abrir calendario, empezar tarea y reagendar', () => {
    queueOpenEvent({ eventId: 'e1', startsAt: '2026-08-05T10:00:00.000Z' })
    expect(consumeQueuedOpenEvent()).toEqual({
      eventId: 'e1',
      startsAt: '2026-08-05T10:00:00.000Z',
    })
    expect(consumeQueuedOpenEvent()).toBeNull()

    queueStartTask('e2')
    expect(consumeQueuedStartTask()).toBe('e2')
    expect(consumeQueuedStartTask()).toBeNull()

    queueRescheduleEvent({
      eventId: 'e3',
      originalStartsAt: '2026-08-05T10:00:00.000Z',
      newStartsAt: '2026-08-06T10:00:00.000Z',
    })
    expect(consumeQueuedRescheduleEvent()).toEqual({
      eventId: 'e3',
      originalStartsAt: '2026-08-05T10:00:00.000Z',
      newStartsAt: '2026-08-06T10:00:00.000Z',
    })
    expect(consumeQueuedRescheduleEvent()).toBeNull()

    queueCompleteTask('e4')
    expect(consumeQueuedCompleteTask()).toBe('e4')
    expect(consumeQueuedCompleteTask()).toBeNull()

    queueExtendTaskEnd('e5')
    expect(consumeQueuedExtendTaskEnd()).toBe('e5')
    expect(consumeQueuedExtendTaskEnd()).toBeNull()

    queueTaskEndClosed('e6')
    expect(consumeQueuedTaskEndClosed()).toBe('e6')
    expect(consumeQueuedTaskEndClosed()).toBeNull()
  })

  it('guarda y consume el aviso de fin de tarea, y rechaza un id inválido', () => {
    const token = storeTaskEndPayload({
      eventId: 'task-1',
      title: 'Informe',
      endsAt: '2026-09-29T13:00:00.000Z',
    })
    const data = consumeTaskEndPayload(token)
    expect(data?.eventId).toBe('task-1')
    expect(data?.title).toBe('Informe')
    expect(data?.endsAt).toBe('2026-09-29T13:00:00.000Z')
    expect(consumeTaskEndPayload(token)).toBeNull()

    const again = storeTaskEndPayload({
      eventId: 'task-1',
      title: 'Informe',
      endsAt: '2026-09-29T13:00:00.000Z',
    })
    expect(loadTaskEndWindowPayload(again)?.title).toBe('Informe')
    expect(loadTaskEndWindowPayload(again)?.title).toBe('Informe')
    releaseTaskEndWindowPayload(again)
    expect(loadTaskEndWindowPayload(again)).toBeNull()

    expect(() =>
      storeTaskEndPayload({
        eventId: '<script>',
        title: 'x',
        endsAt: '2026-09-29T13:00:00.000Z',
      }),
    ).toThrow(/inválido/)
    queueCompleteTask('../etc')
    expect(consumeQueuedCompleteTask()).toBeNull()
  })
})
