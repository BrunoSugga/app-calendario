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
    })
    const data = consumeReminderPayload(token)
    expect(data?.kind).toBe('task')
    expect(data?.eventId).toBe('evt-1')
    expect(data?.startsAt).toBe('2026-08-05T10:00:00.000Z')
    expect(data?.originalStartsAt).toBe('2026-08-05T10:00:00.000Z')
    expect(consumeReminderPayload(token)).toBeNull()
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
