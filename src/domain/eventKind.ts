import type { EventKind, TaskStatus } from '../types'

export function kindLabel(kind: EventKind): string {
  if (kind === 'reminder') return 'Recordatorio'
  if (kind === 'task') return 'Tarea'
  return 'Evento'
}

export function kindGlyph(kind: EventKind): string {
  if (kind === 'reminder') return '●'
  if (kind === 'task') return '☑'
  return '▦'
}

/** Color de bloque por tipo. Evento conserva el color del calendario. */
export function kindColor(kind: EventKind, calendarColor: string): string {
  if (kind === 'reminder') return '#D08A2A'
  if (kind === 'task') return '#2F9B78'
  return calendarColor || '#2F7FD4'
}

export function taskStatusLabel(status: TaskStatus | null | undefined): string {
  if (status === 'in_progress') return 'En curso'
  if (status === 'done') return 'Terminada'
  return 'Pendiente'
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms < 0) return '—'
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
