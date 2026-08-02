import { describe, expect, it } from 'vitest'
import { formatDuration, kindGlyph, kindLabel, taskStatusLabel } from './eventKind'

describe('eventKind helpers', () => {
  it('etiquetas y glifos por tipo', () => {
    expect(kindLabel('event')).toBe('Evento')
    expect(kindLabel('reminder')).toBe('Recordatorio')
    expect(kindLabel('task')).toBe('Tarea')
    expect(kindGlyph('reminder')).toBe('●')
    expect(kindGlyph('task')).toBe('☑')
  })

  it('formatea duración y estado', () => {
    expect(taskStatusLabel('pending')).toBe('Pendiente')
    expect(taskStatusLabel('in_progress')).toBe('En curso')
    expect(taskStatusLabel('done')).toBe('Terminada')
    expect(formatDuration(60_000)).toBe('1 min')
    expect(formatDuration(3_600_000)).toBe('1 h')
  })
})
