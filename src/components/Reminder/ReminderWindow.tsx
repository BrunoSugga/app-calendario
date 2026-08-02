import { useEffect, useMemo, useState } from 'react'
import { kindLabel } from '../../domain/eventKind'
import {
  consumeReminderPayload,
  isTauri,
  notifyMainOpenEvent,
  notifyMainStartTask,
  type ReminderPayload,
} from '../../lib/tauri'
import { isSafeReminderToken } from '../../lib/security'

const SNOOZE_OPTIONS = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '15 min', minutes: 15 },
  { label: '1 semana', minutes: 7 * 24 * 60 },
  { label: '2 semanas', minutes: 14 * 24 * 60 },
  { label: '1 mes', minutes: 30 * 24 * 60 },
] as const

function loadReminder(): ReminderPayload | null {
  const token = new URLSearchParams(window.location.search).get('t') ?? ''
  if (!isSafeReminderToken(token)) return null
  return consumeReminderPayload(token)
}

function clearFiredForEvent(eventId: string): void {
  try {
    const raw = localStorage.getItem('calendario.reminders.fired')
    const list = raw ? (JSON.parse(raw) as string[]) : []
    const next = list.filter((key) => !key.startsWith(`${eventId}:`))
    localStorage.setItem('calendario.reminders.fired', JSON.stringify(next))
  } catch {
    // ignore
  }
}

function playReminderSound(): void {
  try {
    const muted = localStorage.getItem('calendario.reminder.mute') === '1'
    if (muted) return
    const audio = new Audio(`${import.meta.env.BASE_URL}sounds/reminder.wav`)
    audio.volume = 0.75
    void audio.play().catch(() => {
      // autoplay may be blocked; ignore
    })
  } catch {
    // ignore
  }
}

function formatSnoozeLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h`
  if (minutes < 14 * 24 * 60) return `${Math.round(minutes / (24 * 60))} semana(s)`
  return `${Math.round(minutes / (30 * 24 * 60))} mes`
}

export function ReminderWindow() {
  const data = useMemo(() => loadReminder(), [])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (data) playReminderSound()
  }, [data])

  async function closeWindow() {
    if (!isTauri()) {
      window.close()
      return
    }
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().close()
  }

  async function snooze(minutes: number) {
    if (!data?.eventId) return
    const until = Date.now() + minutes * 60 * 1000
    localStorage.setItem(`calendario.snooze.${data.eventId}`, String(until))
    clearFiredForEvent(data.eventId)
    setMessage(`Pospuesto ${formatSnoozeLabel(minutes)}`)
    window.setTimeout(() => {
      void closeWindow()
    }, 600)
  }

  async function openInCalendar() {
    if (!data) return
    await notifyMainOpenEvent({ eventId: data.eventId, startsAt: data.startsAt })
    setMessage('Abriendo calendario…')
    window.setTimeout(() => {
      void closeWindow()
    }, 400)
  }

  async function startTask() {
    if (!data) return
    await notifyMainStartTask(data.eventId)
    setMessage('Tarea iniciada')
    window.setTimeout(() => {
      void closeWindow()
    }, 500)
  }

  if (!data) {
    return (
      <div className="reminder-window">
        <header>
          <h1>Recordatorio</h1>
        </header>
        <div className="reminder-body">
          <p className="form-error">Recordatorio inválido o expirado.</p>
        </div>
        <footer className="reminder-actions">
          <button type="button" className="btn primary" onClick={() => void closeWindow()}>
            Cerrar
          </button>
        </footer>
      </div>
    )
  }

  return (
    <div className="reminder-window">
      <header>
        <h1>{kindLabel(data.kind)}</h1>
      </header>
      <div className="reminder-body">
        <h2>{data.title || 'Sin título'}</h2>
        <p className="reminder-time">{data.timeLabel}</p>
        <p className="reminder-cal">{data.calendarName}</p>
        {data.description && <p className="reminder-desc">{data.description}</p>}
        {message && <p className="muted">{message}</p>}
      </div>
      <footer className="reminder-actions">
        <div className="snooze-group">
          <span className="snooze-label">Aplazar</span>
          {SNOOZE_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              type="button"
              className="btn"
              onClick={() => void snooze(opt.minutes)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="reminder-main-actions">
          {data.kind === 'task' && (
            <button type="button" className="btn primary" onClick={() => void startTask()}>
              Empezar tarea
            </button>
          )}
          <button type="button" className="btn" onClick={() => void openInCalendar()}>
            Abrir en calendario
          </button>
          <button type="button" className="btn" onClick={() => void closeWindow()}>
            Descartar
          </button>
        </div>
      </footer>
    </div>
  )
}
