import { createId } from './id'
import { clampText } from './security'
import type { EventKind } from '../types'
import { normalizeEventKind } from '../types'

const REMINDER_PREFIX = 'calendario.reminder.payload.'
const OPEN_EVENT_KEY = 'calendario.pending.open-event'
const START_TASK_KEY = 'calendario.pending.start-task'

export type ReminderPayload = {
  title: string
  timeLabel: string
  calendarName: string
  description: string
  eventId: string
  kind: EventKind
  startsAt: string
  exp: number
}

export type OpenEventPayload = {
  eventId: string
  startsAt: string
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function storeReminderPayload(payload: Omit<ReminderPayload, 'exp'>): string {
  const token = createId().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 36)
  const data: ReminderPayload = {
    title: clampText(payload.title, 200),
    timeLabel: clampText(payload.timeLabel, 64),
    calendarName: clampText(payload.calendarName, 120),
    description: clampText(payload.description, 500),
    eventId: clampText(payload.eventId, 80),
    kind: normalizeEventKind(payload.kind),
    startsAt: clampText(payload.startsAt, 40),
    exp: Date.now() + 5 * 60 * 1000,
  }
  localStorage.setItem(`${REMINDER_PREFIX}${token}`, JSON.stringify(data))
  return token
}

export function consumeReminderPayload(token: string): ReminderPayload | null {
  const key = `${REMINDER_PREFIX}${token}`
  try {
    const raw = localStorage.getItem(key)
    localStorage.removeItem(key)
    if (!raw) return null
    const data = JSON.parse(raw) as ReminderPayload
    if (!data || typeof data !== 'object') return null
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return {
      ...data,
      kind: normalizeEventKind(data.kind),
      startsAt: typeof data.startsAt === 'string' ? data.startsAt : new Date().toISOString(),
    }
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function queueOpenEvent(payload: OpenEventPayload): void {
  localStorage.setItem(OPEN_EVENT_KEY, JSON.stringify({ ...payload, at: Date.now() }))
}

export function consumeQueuedOpenEvent(): OpenEventPayload | null {
  try {
    const raw = localStorage.getItem(OPEN_EVENT_KEY)
    if (!raw) return null
    localStorage.removeItem(OPEN_EVENT_KEY)
    const data = JSON.parse(raw) as OpenEventPayload & { at?: number }
    if (!data?.eventId || !data?.startsAt) return null
    if (data.at && Date.now() - data.at > 60_000) return null
    return { eventId: data.eventId, startsAt: data.startsAt }
  } catch {
    localStorage.removeItem(OPEN_EVENT_KEY)
    return null
  }
}

export function queueStartTask(eventId: string): void {
  localStorage.setItem(START_TASK_KEY, JSON.stringify({ eventId, at: Date.now() }))
}

export function consumeQueuedStartTask(): string | null {
  try {
    const raw = localStorage.getItem(START_TASK_KEY)
    if (!raw) return null
    localStorage.removeItem(START_TASK_KEY)
    const data = JSON.parse(raw) as { eventId?: string; at?: number }
    if (!data?.eventId) return null
    if (data.at && Date.now() - data.at > 60_000) return null
    return data.eventId
  } catch {
    localStorage.removeItem(START_TASK_KEY)
    return null
  }
}

export async function focusMainWindow(): Promise<void> {
  if (!isTauri()) return
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const main = await WebviewWindow.getByLabel('main')
  if (!main) return
  await main.show()
  await main.setFocus()
}

export async function notifyMainOpenEvent(payload: OpenEventPayload): Promise<void> {
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
  queueStartTask(eventId)
  if (isTauri()) {
    const { emitTo } = await import('@tauri-apps/api/event')
    await focusMainWindow()
    await emitTo('main', 'calendario:start-task', { eventId })
  } else {
    window.dispatchEvent(new CustomEvent('calendario:start-task', { detail: { eventId } }))
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
}): Promise<void> {
  if (!isTauri()) {
    window.alert(`${payload.title}\n${payload.timeLabel}\n${payload.calendarName}`)
    return
  }

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const token = storeReminderPayload(payload)
  const label = `reminder-${payload.eventId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8)}-${Date.now()}`

  const win = new WebviewWindow(label, {
    url: `/?reminder=1&t=${encodeURIComponent(token)}`,
    title: 'Recordatorio',
    width: 420,
    height: 340,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    focus: true,
    decorations: true,
  })

  win.once('tauri://error', (event) => {
    console.error('No se pudo abrir recordatorio', event)
  })
}
