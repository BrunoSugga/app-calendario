import { createId } from './id'
import { isCapacitor, isTauri } from './platform'
import {
  clampText,
  isSafeId,
  isSafeIsoDate,
  isSafeReminderToken,
} from './security'
import type { EventKind } from '../types'
import { normalizeEventKind } from '../types'

export { isTauri } from './platform'

const REMINDER_PREFIX = 'calendario.reminder.payload.'
const TASK_END_PREFIX = 'calendario.taskEnd.payload.'
const OPEN_EVENT_KEY = 'calendario.pending.open-event'
const START_TASK_KEY = 'calendario.pending.start-task'
const RESCHEDULE_KEY = 'calendario.pending.reschedule'
const COMPLETE_TASK_KEY = 'calendario.pending.complete-task'
const EXTEND_TASK_END_KEY = 'calendario.pending.extend-task-end'
const TASK_END_CLOSED_KEY = 'calendario.pending.task-end-closed'

export type ReminderPayload = {
  title: string
  timeLabel: string
  calendarName: string
  description: string
  eventId: string
  kind: EventKind
  startsAt: string
  originalStartsAt: string
  exp: number
}

export type OpenEventPayload = {
  eventId: string
  startsAt: string
}

export type RescheduleEventPayload = {
  eventId: string
  originalStartsAt: string
  newStartsAt: string
  /** Aplazar una tarea mueve la ventana sin marcar el título como reagendado. */
  preserveTitle?: boolean
}

export type TaskEndPromptPayload = {
  eventId: string
  title: string
  endsAt: string
  exp: number
}

function sanitizeReminderFields(payload: {
  title?: unknown
  timeLabel?: unknown
  calendarName?: unknown
  description?: unknown
  eventId?: unknown
  kind?: unknown
  startsAt?: unknown
  originalStartsAt?: unknown
}): Omit<ReminderPayload, 'exp'> | null {
  const eventId = typeof payload.eventId === 'string' ? payload.eventId : ''
  const startsAt = typeof payload.startsAt === 'string' ? payload.startsAt : ''
  const originalStartsAt =
    typeof payload.originalStartsAt === 'string' && payload.originalStartsAt
      ? payload.originalStartsAt
      : startsAt
  if (!isSafeId(eventId) || !isSafeIsoDate(startsAt) || !isSafeIsoDate(originalStartsAt)) return null
  return {
    title: clampText(String(payload.title ?? ''), 200),
    timeLabel: clampText(String(payload.timeLabel ?? ''), 64),
    calendarName: clampText(String(payload.calendarName ?? ''), 120),
    description: clampText(String(payload.description ?? ''), 500),
    eventId,
    kind: normalizeEventKind(payload.kind),
    startsAt: clampText(startsAt, 40),
    originalStartsAt: clampText(originalStartsAt, 40),
  }
}

export function storeReminderPayload(payload: Omit<ReminderPayload, 'exp'>): string {
  const clean = sanitizeReminderFields(payload)
  if (!clean) throw new Error('Payload de recordatorio inválido')
  const token = createId().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 36)
  if (!isSafeReminderToken(token)) throw new Error('Token de recordatorio inválido')
  const data: ReminderPayload = {
    ...clean,
    exp: Date.now() + 5 * 60 * 1000,
  }
  localStorage.setItem(`${REMINDER_PREFIX}${token}`, JSON.stringify(data))
  return token
}

export function consumeReminderPayload(token: string): ReminderPayload | null {
  if (!isSafeReminderToken(token)) return null
  const key = `${REMINDER_PREFIX}${token}`
  try {
    const raw = localStorage.getItem(key)
    localStorage.removeItem(key)
    if (!raw) return null
    const data = JSON.parse(raw) as ReminderPayload
    if (!data || typeof data !== 'object') return null
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
    const clean = sanitizeReminderFields(data)
    if (!clean) return null
    return { ...clean, exp: data.exp }
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function sanitizeTaskEndFields(payload: {
  eventId?: unknown
  title?: unknown
  endsAt?: unknown
}): Omit<TaskEndPromptPayload, 'exp'> | null {
  const eventId = typeof payload.eventId === 'string' ? payload.eventId : ''
  const endsAt = typeof payload.endsAt === 'string' ? payload.endsAt : ''
  if (!isSafeId(eventId) || !isSafeIsoDate(endsAt)) return null
  return {
    eventId,
    title: clampText(String(payload.title ?? ''), 200),
    endsAt: clampText(endsAt, 40),
  }
}

export function storeTaskEndPayload(payload: Omit<TaskEndPromptPayload, 'exp'>): string {
  const clean = sanitizeTaskEndFields(payload)
  if (!clean) throw new Error('Payload de fin de tarea inválido')
  const token = createId().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 36)
  if (!isSafeReminderToken(token)) throw new Error('Token de fin de tarea inválido')
  const data: TaskEndPromptPayload = {
    ...clean,
    exp: Date.now() + 5 * 60 * 1000,
  }
  localStorage.setItem(`${TASK_END_PREFIX}${token}`, JSON.stringify(data))
  return token
}

export function consumeTaskEndPayload(token: string): TaskEndPromptPayload | null {
  if (!isSafeReminderToken(token)) return null
  const key = `${TASK_END_PREFIX}${token}`
  try {
    const raw = localStorage.getItem(key)
    localStorage.removeItem(key)
    if (!raw) return null
    const data = JSON.parse(raw) as TaskEndPromptPayload
    if (!data || typeof data !== 'object') return null
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
    const clean = sanitizeTaskEndFields(data)
    if (!clean) return null
    return { ...clean, exp: data.exp }
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function queueOpenEvent(payload: OpenEventPayload): void {
  if (!isSafeId(payload.eventId) || !isSafeIsoDate(payload.startsAt)) return
  localStorage.setItem(
    OPEN_EVENT_KEY,
    JSON.stringify({ eventId: payload.eventId, startsAt: payload.startsAt, at: Date.now() }),
  )
}

export function consumeQueuedOpenEvent(): OpenEventPayload | null {
  try {
    const raw = localStorage.getItem(OPEN_EVENT_KEY)
    if (!raw) return null
    localStorage.removeItem(OPEN_EVENT_KEY)
    const data = JSON.parse(raw) as OpenEventPayload & { at?: number }
    if (!data?.eventId || !data?.startsAt) return null
    if (!isSafeId(data.eventId) || !isSafeIsoDate(data.startsAt)) return null
    if (data.at && Date.now() - data.at > 60_000) return null
    return { eventId: data.eventId, startsAt: data.startsAt }
  } catch {
    localStorage.removeItem(OPEN_EVENT_KEY)
    return null
  }
}

export function queueStartTask(eventId: string): void {
  if (!isSafeId(eventId)) return
  localStorage.setItem(START_TASK_KEY, JSON.stringify({ eventId, at: Date.now() }))
}

export function consumeQueuedStartTask(): string | null {
  try {
    const raw = localStorage.getItem(START_TASK_KEY)
    if (!raw) return null
    localStorage.removeItem(START_TASK_KEY)
    const data = JSON.parse(raw) as { eventId?: string; at?: number }
    if (!data?.eventId || !isSafeId(data.eventId)) return null
    if (data.at && Date.now() - data.at > 60_000) return null
    return data.eventId
  } catch {
    localStorage.removeItem(START_TASK_KEY)
    return null
  }
}

export function queueRescheduleEvent(payload: RescheduleEventPayload): void {
  if (
    !isSafeId(payload.eventId) ||
    !isSafeIsoDate(payload.originalStartsAt) ||
    !isSafeIsoDate(payload.newStartsAt)
  ) {
    return
  }
  localStorage.setItem(
    RESCHEDULE_KEY,
    JSON.stringify({ ...payload, at: Date.now() }),
  )
}

export function consumeQueuedRescheduleEvent(): RescheduleEventPayload | null {
  try {
    const raw = localStorage.getItem(RESCHEDULE_KEY)
    if (!raw) return null
    localStorage.removeItem(RESCHEDULE_KEY)
    const data = JSON.parse(raw) as RescheduleEventPayload & { at?: number }
    if (!data?.eventId || !data?.originalStartsAt || !data?.newStartsAt) return null
    if (
      !isSafeId(data.eventId) ||
      !isSafeIsoDate(data.originalStartsAt) ||
      !isSafeIsoDate(data.newStartsAt)
    ) {
      return null
    }
    if (data.at && Date.now() - data.at > 60_000) return null
    return {
      eventId: data.eventId,
      originalStartsAt: data.originalStartsAt,
      newStartsAt: data.newStartsAt,
      ...(data.preserveTitle === true ? { preserveTitle: true as const } : {}),
    }
  } catch {
    localStorage.removeItem(RESCHEDULE_KEY)
    return null
  }
}

function consumeQueuedEventId(key: string): string | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    localStorage.removeItem(key)
    const data = JSON.parse(raw) as { eventId?: string; at?: number }
    if (!data?.eventId || !isSafeId(data.eventId)) return null
    if (data.at && Date.now() - data.at > 60_000) return null
    return data.eventId
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function queueEventId(key: string, eventId: string): void {
  if (!isSafeId(eventId)) return
  localStorage.setItem(key, JSON.stringify({ eventId, at: Date.now() }))
}

export function queueCompleteTask(eventId: string): void {
  queueEventId(COMPLETE_TASK_KEY, eventId)
}

export function consumeQueuedCompleteTask(): string | null {
  return consumeQueuedEventId(COMPLETE_TASK_KEY)
}

export function queueExtendTaskEnd(eventId: string): void {
  queueEventId(EXTEND_TASK_END_KEY, eventId)
}

export function consumeQueuedExtendTaskEnd(): string | null {
  return consumeQueuedEventId(EXTEND_TASK_END_KEY)
}

export function queueTaskEndClosed(eventId: string): void {
  queueEventId(TASK_END_CLOSED_KEY, eventId)
}

export function consumeQueuedTaskEndClosed(): string | null {
  return consumeQueuedEventId(TASK_END_CLOSED_KEY)
}

export async function focusMainWindow(): Promise<void> {
  if (!isTauri()) return
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const main = await WebviewWindow.getByLabel('main')
  if (!main) return
  await main.show()
  await main.unminimize()
  await main.setFocus()
}

export async function notifyMainOpenEvent(payload: OpenEventPayload): Promise<void> {
  if (!isSafeId(payload.eventId) || !isSafeIsoDate(payload.startsAt)) return
  queueOpenEvent(payload)
  if (isTauri()) {
    const { emitTo } = await import('@tauri-apps/api/event')
    await focusMainWindow()
    await emitTo('main', 'calendario:open-event', payload)
  } else {
    window.dispatchEvent(new CustomEvent('calendario:open-event', { detail: payload }))
  }
}

export async function notifyMainStartTask(eventId: string): Promise<void> {
  if (!isSafeId(eventId)) return
  queueStartTask(eventId)
  if (isTauri()) {
    const { emitTo } = await import('@tauri-apps/api/event')
    await focusMainWindow()
    await emitTo('main', 'calendario:start-task', { eventId })
  } else {
    window.dispatchEvent(new CustomEvent('calendario:start-task', { detail: { eventId } }))
  }
}

export async function notifyMainRescheduleEvent(payload: RescheduleEventPayload): Promise<void> {
  if (
    !isSafeId(payload.eventId) ||
    !isSafeIsoDate(payload.originalStartsAt) ||
    !isSafeIsoDate(payload.newStartsAt)
  ) {
    return
  }
  queueRescheduleEvent(payload)
  if (isTauri()) {
    const { emitTo } = await import('@tauri-apps/api/event')
    await focusMainWindow()
    await emitTo('main', 'calendario:reschedule-event', payload)
  } else {
    window.dispatchEvent(new CustomEvent('calendario:reschedule-event', { detail: payload }))
  }
}

export async function notifyMainCompleteTask(eventId: string): Promise<void> {
  if (!isSafeId(eventId)) return
  queueCompleteTask(eventId)
  if (isTauri()) {
    const { emitTo } = await import('@tauri-apps/api/event')
    await focusMainWindow()
    await emitTo('main', 'calendario:complete-task', { eventId })
  } else {
    window.dispatchEvent(new CustomEvent('calendario:complete-task', { detail: { eventId } }))
  }
}

export async function notifyMainExtendTaskEnd(eventId: string): Promise<void> {
  if (!isSafeId(eventId)) return
  queueExtendTaskEnd(eventId)
  if (isTauri()) {
    const { emitTo } = await import('@tauri-apps/api/event')
    await focusMainWindow()
    await emitTo('main', 'calendario:extend-task-end', { eventId })
  } else {
    window.dispatchEvent(new CustomEvent('calendario:extend-task-end', { detail: { eventId } }))
  }
}

export async function openReminderWindow(payload: {
  title: string
  timeLabel: string
  calendarName: string
  description: string
  eventId: string
  kind: EventKind
  startsAt: string
  originalStartsAt: string
}): Promise<boolean> {
  if (
    !isSafeId(payload.eventId) ||
    !isSafeIsoDate(payload.startsAt) ||
    !isSafeIsoDate(payload.originalStartsAt)
  ) {
    console.error('Recordatorio omitido: identificadores inválidos')
    return false
  }

  if (isCapacitor()) {
    window.dispatchEvent(
      new CustomEvent('calendario:show-reminder', { detail: { payload } }),
    )
    return true
  }

  const token = storeReminderPayload(payload)

  const reminderQuery = `reminder=1&t=${encodeURIComponent(token)}`

  if (!isTauri()) {
    const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin)
    url.searchParams.set('reminder', '1')
    url.searchParams.set('t', token)
    const popup = window.open(
      url.toString(),
      `calendario-reminder-${payload.eventId.slice(0, 24)}`,
      'popup=yes,width=440,height=460,resizable=no,scrollbars=yes',
    )
    if (popup) {
      popup.focus()
      return true
    }

    // Popup bloqueado: Notification API o alert de respaldo
    try {
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          new Notification(payload.title || 'Recordatorio', {
            body: `${payload.timeLabel}\n${payload.calendarName}`,
          })
          window.alert(
            `${payload.title}\n${payload.timeLabel}\n${payload.calendarName}\n\nPermití ventanas emergentes para la UI completa del aviso.`,
          )
          return true
        }
        if (Notification.permission !== 'denied') {
          void Notification.requestPermission()
        }
      }
    } catch {
      // ignore
    }

    window.alert(
      `${payload.title}\n${payload.timeLabel}\n${payload.calendarName}\n\nPermití ventanas emergentes para ver el aviso completo.`,
    )
    return true
  }

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const safeEvent = payload.eventId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8)
  const label = `reminder-${safeEvent}-${Date.now()}`

  const win = new WebviewWindow(label, {
    url: `/?${reminderQuery}`,
    title: 'Recordatorio',
    width: 440,
    height: 460,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    focus: true,
    decorations: true,
  })

  return await new Promise<boolean>((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    win.once('tauri://created', () => done(true))
    win.once('tauri://error', (event) => {
      console.error('No se pudo abrir recordatorio', event)
      done(false)
    })
    // Si no hay evento a tiempo, asumir OK (comportamiento previo) para no re-disparar en bucle
    window.setTimeout(() => done(true), 1500)
  })
}

export async function openTaskEndPromptWindow(payload: {
  eventId: string
  title: string
  endsAt: string
}): Promise<boolean> {
  if (!isSafeId(payload.eventId) || !isSafeIsoDate(payload.endsAt)) {
    console.error('Aviso de fin de tarea omitido: identificadores inválidos')
    return false
  }

  if (isCapacitor()) return false

  let token = ''
  try {
    token = storeTaskEndPayload(payload)
  } catch (err) {
    console.error('No se pudo preparar el aviso de fin de tarea', err)
    return false
  }

  const taskEndQuery = `task-end=1&t=${encodeURIComponent(token)}`

  if (!isTauri()) {
    const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin)
    url.searchParams.set('task-end', '1')
    url.searchParams.set('t', token)
    const popup = window.open(
      url.toString(),
      `calendario-task-end-${payload.eventId.slice(0, 24)}`,
      'popup=yes,width=440,height=280,resizable=no,scrollbars=yes',
    )
    if (popup) {
      popup.focus()
      return true
    }
    return false
  }

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const safeEvent = payload.eventId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8)
  const label = `reminder-${safeEvent}-end-${Date.now()}`

  const win = new WebviewWindow(label, {
    url: `/?${taskEndQuery}`,
    title: '¿Terminaste la tarea?',
    width: 440,
    height: 280,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    focus: true,
    decorations: true,
  })

  return await new Promise<boolean>((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    win.once('tauri://created', () => done(true))
    win.once('tauri://error', (event) => {
      console.error('No se pudo abrir el aviso de fin de tarea', event)
      done(false)
    })
    window.setTimeout(() => done(true), 1500)
  })
}
