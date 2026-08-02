import { beforeEach, describe, expect, it } from 'vitest'
import {
  consumeQueuedOpenEvent,
  consumeQueuedStartTask,
  consumeReminderPayload,
  queueOpenEvent,
  queueStartTask,
  storeReminderPayload,
} from './tauri'

describe('reminder payload / bridges', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('guarda y consume payload con kind y startsAt', () => {
    const token = storeReminderPayload({
      title: 'Tarea',
      timeLabel: '10:00',
      calendarName: 'Personal',
      description: 'desc',
      eventId: 'evt-1',
      kind: 'task',
      startsAt: '2026-08-05T10:00:00.000Z',
    })
    const data = consumeReminderPayload(token)
    expect(data?.kind).toBe('task')
    expect(data?.eventId).toBe('evt-1')
    expect(data?.startsAt).toBe('2026-08-05T10:00:00.000Z')
    expect(consumeReminderPayload(token)).toBeNull()
  })

  it('encola abrir calendario y empezar tarea', () => {
    queueOpenEvent({ eventId: 'e1', startsAt: '2026-08-05T10:00:00.000Z' })
    expect(consumeQueuedOpenEvent()).toEqual({
      eventId: 'e1',
      startsAt: '2026-08-05T10:00:00.000Z',
    })
    expect(consumeQueuedOpenEvent()).toBeNull()

    queueStartTask('e2')
    expect(consumeQueuedStartTask()).toBe('e2')
    expect(consumeQueuedStartTask()).toBeNull()
  })
})
