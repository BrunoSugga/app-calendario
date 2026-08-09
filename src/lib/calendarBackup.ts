import type { Calendar, CalendarEvent, EventException, EventKind, TaskRun, TaskStatus } from '../types'
import { normalizeEventKind, normalizeTaskStatus } from '../types'
import { createId } from './id'
import {
  clampText,
  isSafeId,
  isSafeIsoDate,
  sanitizeCalendarName,
  sanitizeColor,
  sanitizeRRule,
  sanitizeTaskNote,
} from './security'
import type { CalendarSnapshot } from './repositories/types'

export const CALENDAR_BACKUP_VERSION = 1 as const

/** Tope de tamaño del archivo JSON de respaldo (antes de leer/parsear). */
export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024

export const MAX_BACKUP_EVENTS = 5000
export const MAX_BACKUP_EXCEPTIONS = 5000
export const MAX_BACKUP_TASK_RUNS = 10_000

export type CalendarBackup = {
  version: typeof CALENDAR_BACKUP_VERSION
  exportedAt: string
  calendar: Pick<Calendar, 'name' | 'color'>
  events: CalendarEvent[]
  exceptions: EventException[]
  taskRuns: TaskRun[]
}

export function assertBackupFileWithinLimit(file: { size: number; name?: string }): void {
  if (!Number.isFinite(file.size) || file.size < 0) {
    throw new Error('Archivo de respaldo inválido')
  }
  if (file.size === 0) {
    throw new Error('El archivo de respaldo está vacío')
  }
  if (file.size > MAX_BACKUP_FILE_BYTES) {
    const mb = Math.round(MAX_BACKUP_FILE_BYTES / (1024 * 1024))
    throw new Error(`El respaldo supera el máximo de ${mb} MB`)
  }
}

export function buildCalendarBackup(state: CalendarSnapshot, calendarId: string): CalendarBackup {
  const calendar = state.calendars.find((c) => c.id === calendarId)
  if (!calendar) throw new Error('Calendario no encontrado')

  const events = state.events.filter((e) => e.calendar_id === calendarId)
  const eventIds = new Set(events.map((e) => e.id))
  const exceptions = state.exceptions.filter((ex) => eventIds.has(ex.event_id))
  const taskRuns = state.taskRuns.filter((r) => eventIds.has(r.event_id))

  return {
    version: CALENDAR_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    calendar: { name: calendar.name, color: calendar.color },
    events,
    exceptions,
    taskRuns,
  }
}

export function backupFilename(calendarName: string, at = new Date()): string {
  const safe = clampText(calendarName, 40)
    .replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'calendario'
  const stamp = at.toISOString().slice(0, 10)
  return `calendario-backup-${safe}-${stamp}.json`
}

export function downloadCalendarBackup(backup: CalendarBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFilename(backup.calendar.name, new Date(backup.exportedAt))
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseEvent(row: unknown, fallbackUserId: string): CalendarEvent {
  const obj = asRecord(row)
  if (!obj) throw new Error('Evento inválido en el respaldo')
  const kind = normalizeEventKind(obj.kind) as EventKind
  const starts_at = String(obj.starts_at ?? '')
  const ends_at = String(obj.ends_at ?? '')
  if (!isSafeIsoDate(starts_at) || !isSafeIsoDate(ends_at)) {
    throw new Error('Fechas de evento inválidas en el respaldo')
  }
  return {
    id: typeof obj.id === 'string' && isSafeId(obj.id) ? obj.id : createId(),
    user_id: fallbackUserId,
    calendar_id: typeof obj.calendar_id === 'string' ? obj.calendar_id : '',
    title: clampText(String(obj.title ?? ''), 200),
    description: clampText(String(obj.description ?? ''), 5000),
    starts_at,
    ends_at,
    all_day: Boolean(obj.all_day),
    reminder_minutes: Math.min(10080, Math.max(0, Number(obj.reminder_minutes ?? 15) || 0)),
    rrule: sanitizeRRule(obj.rrule as string | null | undefined),
    kind,
    task_status: normalizeTaskStatus(obj.task_status, kind) as TaskStatus | null,
    task_started_at:
      typeof obj.task_started_at === 'string' && isSafeIsoDate(obj.task_started_at)
        ? obj.task_started_at
        : null,
    task_completed_at:
      typeof obj.task_completed_at === 'string' && isSafeIsoDate(obj.task_completed_at)
        ? obj.task_completed_at
        : null,
    task_duration_ms:
      typeof obj.task_duration_ms === 'number' && Number.isFinite(obj.task_duration_ms)
        ? Math.max(0, obj.task_duration_ms)
        : null,
    task_note:
      typeof obj.task_note === 'string' ? sanitizeTaskNote(obj.task_note) : null,
    created_at:
      typeof obj.created_at === 'string' && isSafeIsoDate(obj.created_at)
        ? obj.created_at
        : new Date().toISOString(),
    updated_at:
      typeof obj.updated_at === 'string' && isSafeIsoDate(obj.updated_at)
        ? obj.updated_at
        : new Date().toISOString(),
  }
}

function parseException(row: unknown, fallbackUserId: string): EventException {
  const obj = asRecord(row)
  if (!obj) throw new Error('Excepción inválida en el respaldo')
  const original_starts_at = String(obj.original_starts_at ?? '')
  if (!isSafeIsoDate(original_starts_at)) {
    throw new Error('Excepción con fecha inválida en el respaldo')
  }
  return {
    id: typeof obj.id === 'string' && isSafeId(obj.id) ? obj.id : createId(),
    event_id: typeof obj.event_id === 'string' ? obj.event_id : '',
    user_id: fallbackUserId,
    original_starts_at,
    is_cancelled: Boolean(obj.is_cancelled),
    title: typeof obj.title === 'string' ? clampText(obj.title, 200) : null,
    description: typeof obj.description === 'string' ? clampText(obj.description, 5000) : null,
    starts_at:
      typeof obj.starts_at === 'string' && isSafeIsoDate(obj.starts_at) ? obj.starts_at : null,
    ends_at: typeof obj.ends_at === 'string' && isSafeIsoDate(obj.ends_at) ? obj.ends_at : null,
    all_day: typeof obj.all_day === 'boolean' ? obj.all_day : null,
    reminder_minutes:
      typeof obj.reminder_minutes === 'number' ? Math.min(10080, Math.max(0, obj.reminder_minutes)) : null,
    created_at:
      typeof obj.created_at === 'string' && isSafeIsoDate(obj.created_at)
        ? obj.created_at
        : new Date().toISOString(),
  }
}

function parseTaskRun(row: unknown, fallbackUserId: string): TaskRun {
  const obj = asRecord(row)
  if (!obj) throw new Error('Historial de tarea inválido en el respaldo')
  const started_at = String(obj.started_at ?? '')
  const completed_at = String(obj.completed_at ?? '')
  if (!isSafeIsoDate(started_at) || !isSafeIsoDate(completed_at)) {
    throw new Error('Fechas de historial inválidas en el respaldo')
  }
  return {
    id: typeof obj.id === 'string' && isSafeId(obj.id) ? obj.id : createId(),
    event_id: typeof obj.event_id === 'string' ? obj.event_id : '',
    user_id: fallbackUserId,
    started_at,
    completed_at,
    duration_ms: Math.max(0, Number(obj.duration_ms ?? 0) || 0),
    note: sanitizeTaskNote(String(obj.note ?? '')),
    created_at:
      typeof obj.created_at === 'string' && isSafeIsoDate(obj.created_at)
        ? obj.created_at
        : new Date().toISOString(),
  }
}

export function parseCalendarBackup(raw: unknown, userId: string): CalendarBackup {
  const obj = asRecord(raw)
  if (!obj) throw new Error('Respaldo inválido')
  if (obj.version !== CALENDAR_BACKUP_VERSION) {
    throw new Error('Versión de respaldo no soportada')
  }
  const cal = asRecord(obj.calendar)
  if (!cal) throw new Error('El respaldo no incluye calendario')
  const name = sanitizeCalendarName(String(cal.name ?? ''))
  const color = sanitizeColor(String(cal.color ?? '#3D9BE0'))

  const eventsRaw = Array.isArray(obj.events) ? obj.events : []
  const exceptionsRaw = Array.isArray(obj.exceptions) ? obj.exceptions : []
  const taskRunsRaw = Array.isArray(obj.taskRuns) ? obj.taskRuns : []

  if (eventsRaw.length > MAX_BACKUP_EVENTS) {
    throw new Error(`El respaldo tiene demasiados eventos (máx. ${MAX_BACKUP_EVENTS})`)
  }
  if (exceptionsRaw.length > MAX_BACKUP_EXCEPTIONS) {
    throw new Error(`El respaldo tiene demasiadas excepciones (máx. ${MAX_BACKUP_EXCEPTIONS})`)
  }
  if (taskRunsRaw.length > MAX_BACKUP_TASK_RUNS) {
    throw new Error(`El respaldo tiene demasiado historial de tareas (máx. ${MAX_BACKUP_TASK_RUNS})`)
  }

  return {
    version: CALENDAR_BACKUP_VERSION,
    exportedAt:
      typeof obj.exportedAt === 'string' && isSafeIsoDate(obj.exportedAt)
        ? obj.exportedAt
        : new Date().toISOString(),
    calendar: { name, color },
    events: eventsRaw.map((e) => parseEvent(e, userId)),
    exceptions: exceptionsRaw.map((e) => parseException(e, userId)),
    taskRuns: taskRunsRaw.map((r) => parseTaskRun(r, userId)),
  }
}

/** Remapea IDs para importar sin colisionar con datos existentes. */
export function remapBackupForImport(
  backup: CalendarBackup,
  userId: string,
): {
  calendar: Calendar
  events: CalendarEvent[]
  exceptions: EventException[]
  taskRuns: TaskRun[]
} {
  const now = new Date().toISOString()
  const calendarId = createId()
  const eventIdMap = new Map<string, string>()

  const events = backup.events.map((e) => {
    const newId = createId()
    eventIdMap.set(e.id, newId)
    return {
      ...e,
      id: newId,
      user_id: userId,
      calendar_id: calendarId,
      created_at: e.created_at || now,
      updated_at: now,
    }
  })

  const exceptions = backup.exceptions
    .map((ex) => {
      const eventId = eventIdMap.get(ex.event_id)
      if (!eventId) return null
      return {
        ...ex,
        id: createId(),
        event_id: eventId,
        user_id: userId,
      }
    })
    .filter((ex): ex is EventException => ex != null)

  const taskRuns = backup.taskRuns
    .map((r) => {
      const eventId = eventIdMap.get(r.event_id)
      if (!eventId) return null
      return {
        ...r,
        id: createId(),
        event_id: eventId,
        user_id: userId,
      }
    })
    .filter((r): r is TaskRun => r != null)

  const calendar: Calendar = {
    id: calendarId,
    user_id: userId,
    name: backup.calendar.name,
    color: backup.calendar.color,
    is_default: false,
    visible: true,
    created_at: now,
  }

  return { calendar, events, exceptions, taskRuns }
}
