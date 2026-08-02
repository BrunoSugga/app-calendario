import { createId } from './id'
import { clampText } from './security'

const REMINDER_PREFIX = 'calendario.reminder.payload.'

export type ReminderPayload = {
  title: string
  timeLabel: string
  calendarName: string
  description: string
  eventId: string
  exp: number
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
    return data
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export async function openReminderWindow(payload: {
  title: string
  timeLabel: string
  calendarName: string
  description: string
  eventId: string
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
    width: 380,
    height: 220,
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
