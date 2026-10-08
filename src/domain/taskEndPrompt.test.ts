import { describe, expect, it } from 'vitest'
import { buildRRule } from './recurrence'
import {
  extendedTaskEnd,
  isSupersededInProgressTask,
  selectDueTaskEndPrompts,
  taskEndCheckpoint,
  taskEndExtensionDraft,
  taskEndPromptKey,
} from './taskEndPrompt'
import type { Calendar, CalendarEvent, EventException } from '../types'

const calendar: Calendar = {
  id: 'cal-1',
  user_id: 'user-1',
  name: 'Personal',
  color: '#2F7FD4',
  is_default: true,
  visible: true,
  created_at: '2026-09-01T00:00:00.000Z',
}

function task(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'task-1',
    user_id: 'user-1',
    calendar_id: 'cal-1',
    title: 'Informe',
    description: 'cerrar cifras',
    starts_at: '2026-09-29T12:00:00.000Z',
    ends_at: '2026-09-29T13:00:00.000Z',
    all_day: false,
    reminder_minutes: 10,
    rrule: null,
    kind: 'task',
    task_status: 'in_progress',
    task_started_at: '2026-09-29T12:05:00.000Z',
    task_completed_at: null,
    task_duration_ms: null,
    task_note: null,
    created_at: '2026-09-29T12:00:00.000Z',
    updated_at: '2026-09-29T12:05:00.000Z',
    ...overrides,
  }
}

describe('taskEndPrompt', () => {
  const exceptions: EventException[] = []

  it('pregunta solo si la tarea está en curso y ya llegó la hora de fin', () => {
    const now = new Date('2026-09-29T13:00:00.000Z')
    const started = task()
    expect(taskEndCheckpoint(started, [calendar], exceptions, now)?.endsAt.toISOString()).toBe(
      '2026-09-29T13:00:00.000Z',
    )
    expect(selectDueTaskEndPrompts([started], [calendar], exceptions, now, new Set())).toHaveLength(1)

    const beforeEnd = new Date('2026-09-29T12:59:00.000Z')
    expect(selectDueTaskEndPrompts([started], [calendar], exceptions, beforeEnd, new Set())).toHaveLength(0)

    const pending = task({ task_status: 'pending', task_started_at: null })
    expect(selectDueTaskEndPrompts([pending], [calendar], exceptions, now, new Set())).toHaveLength(0)

    const event = task({ kind: 'event', task_status: null, task_started_at: null })
    expect(selectDueTaskEndPrompts([event], [calendar], exceptions, now, new Set())).toHaveLength(0)
  })

  it('no vuelve a preguntar por la misma hora de fin', () => {
    const now = new Date('2026-09-29T13:10:00.000Z')
    const started = task()
    const checkpoint = taskEndCheckpoint(started, [calendar], exceptions, now)
    expect(checkpoint).not.toBeNull()
    const key = taskEndPromptKey(checkpoint!.eventId, checkpoint!.endsAt)
    expect(selectDueTaskEndPrompts([started], [calendar], exceptions, now, new Set([key]))).toHaveLength(0)
  })

  it('en una serie usa el fin del bloque en curso, no el de ayer', () => {
    const series = task({
      starts_at: '2026-09-28T12:00:00.000Z',
      ends_at: '2026-09-28T13:00:00.000Z',
      rrule: buildRRule('daily', new Date('2026-09-28T12:00:00.000Z')),
      task_started_at: '2026-09-29T12:05:00.000Z',
    })
    const during = new Date('2026-09-29T12:30:00.000Z')
    expect(selectDueTaskEndPrompts([series], [calendar], exceptions, during, new Set())).toHaveLength(0)

    const after = new Date('2026-09-29T13:01:00.000Z')
    const due = selectDueTaskEndPrompts([series], [calendar], exceptions, after, new Set())
    expect(due).toHaveLength(1)
    expect(due[0].endsAt.toISOString()).toBe('2026-09-29T13:00:00.000Z')
    expect(due[0].isRecurring).toBe(true)
  })

  it('si se empezó antes del bloque, espera la hora de fin de ese bloque', () => {
    const early = task({ task_started_at: '2026-09-29T11:00:00.000Z' })
    const now = new Date('2026-09-29T11:30:00.000Z')
    expect(selectDueTaskEndPrompts([early], [calendar], exceptions, now, new Set())).toHaveLength(0)
    const checkpoint = taskEndCheckpoint(early, [calendar], exceptions, now)
    expect(checkpoint?.endsAt.toISOString()).toBe('2026-09-29T13:00:00.000Z')
  })

  it('extiende una hora, y si esa hora ya pasó deja la próxima pregunta dentro de una hora', () => {
    const end = new Date('2026-09-29T13:00:00.000Z')
    expect(extendedTaskEnd(end, new Date('2026-09-29T13:00:00.000Z')).toISOString()).toBe(
      '2026-09-29T14:00:00.000Z',
    )
    expect(extendedTaskEnd(end, new Date('2026-09-29T13:10:00.000Z')).toISOString()).toBe(
      '2026-09-29T14:00:00.000Z',
    )
    expect(extendedTaskEnd(end, new Date('2026-09-29T15:30:00.000Z')).toISOString()).toBe(
      '2026-09-29T16:30:00.000Z',
    )
  })

  it('no vuelve a preguntar por un día viejo si ya empezó una repetición posterior', () => {
    const series = task({
      starts_at: '2026-09-28T12:00:00.000Z',
      ends_at: '2026-09-28T13:00:00.000Z',
      rrule: buildRRule('daily', new Date('2026-09-28T12:00:00.000Z')),
      task_started_at: '2026-09-28T12:05:00.000Z',
    })
    const duringNext = new Date('2026-09-30T12:30:00.000Z')
    expect(isSupersededInProgressTask(series, [calendar], exceptions, duringNext)).toBe(true)
    expect(selectDueTaskEndPrompts([series], [calendar], exceptions, duringNext, new Set())).toHaveLength(0)

    const sameDayAfterEnd = new Date('2026-09-29T13:01:00.000Z')
    const stillThatRun = task({
      ...series,
      task_started_at: '2026-09-29T12:05:00.000Z',
    })
    expect(isSupersededInProgressTask(stillThatRun, [calendar], exceptions, sameDayAfterEnd)).toBe(false)
    expect(selectDueTaskEndPrompts([stillThatRun], [calendar], exceptions, sameDayAfterEnd, new Set())).toHaveLength(
      1,
    )
  })

  it('al empezar una serie aplazada espera el fin movido', () => {
    const series = task({
      starts_at: '2026-09-28T12:00:00.000Z',
      ends_at: '2026-09-28T13:00:00.000Z',
      rrule: buildRRule('daily', new Date('2026-09-28T12:00:00.000Z')),
      task_started_at: '2026-09-29T16:00:00.000Z',
    })
    const moved: EventException = {
      id: 'ex-1',
      event_id: series.id,
      user_id: 'user-1',
      original_starts_at: '2026-09-29T12:00:00.000Z',
      is_cancelled: false,
      title: null,
      description: null,
      starts_at: '2026-09-29T16:00:00.000Z',
      ends_at: '2026-09-29T17:00:00.000Z',
      all_day: null,
      reminder_minutes: null,
      created_at: '2026-09-29T12:00:00.000Z',
    }
    const atStart = new Date('2026-09-29T16:00:00.000Z')
    expect(selectDueTaskEndPrompts([series], [calendar], [moved], atStart, new Set())).toHaveLength(0)
    expect(taskEndCheckpoint(series, [calendar], [moved], atStart)?.endsAt.toISOString()).toBe(
      '2026-09-29T17:00:00.000Z',
    )

    const afterEnd = new Date('2026-09-29T17:00:00.000Z')
    const due = selectDueTaskEndPrompts([series], [calendar], [moved], afterEnd, new Set())
    expect(due).toHaveLength(1)
    expect(due[0].endsAt.toISOString()).toBe('2026-09-29T17:00:00.000Z')
  })

  it('arma el guardado de la extensión sin perder el alcance de una serie', () => {
    const now = new Date('2026-09-29T13:00:00.000Z')
    const single = task()
    const singleCheckpoint = taskEndCheckpoint(single, [calendar], exceptions, now)!
    const singleDraft = taskEndExtensionDraft(single, singleCheckpoint, now)
    expect(singleDraft.editScope).toBe('series')
    expect(singleDraft.ends_at).toBe('2026-09-29T14:00:00.000Z')
    expect(singleDraft.occurrenceOriginalStartsAt).toBeUndefined()

    const series = task({
      starts_at: '2026-09-28T12:00:00.000Z',
      ends_at: '2026-09-28T13:00:00.000Z',
      rrule: buildRRule('daily', new Date('2026-09-28T12:00:00.000Z')),
    })
    const seriesCheckpoint = taskEndCheckpoint(series, [calendar], exceptions, now)!
    const seriesDraft = taskEndExtensionDraft(series, seriesCheckpoint, now)
    expect(seriesDraft.editScope).toBe('single')
    expect(seriesDraft.occurrenceOriginalStartsAt).toBe('2026-09-29T12:00:00.000Z')
    expect(seriesDraft.ends_at).toBe('2026-09-29T14:00:00.000Z')
  })

  it('ignora una hora de fin inválida', () => {
    const broken = task({ ends_at: 'no-es-fecha', starts_at: 'tampoco' })
    const now = new Date('2026-09-29T13:00:00.000Z')
    expect(taskEndCheckpoint(broken, [calendar], exceptions, now)).toBeNull()
  })
})
