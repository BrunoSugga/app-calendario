import { useMemo, useState } from 'react'
import { consumeReminderPayload, isTauri, type ReminderPayload } from '../../lib/tauri'
import { isSafeReminderToken } from '../../lib/security'

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

export function ReminderWindow() {
  const data = useMemo(() => loadReminder(), [])
  const [message, setMessage] = useState<string | null>(null)

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
    setMessage(`Pospuesto ${minutes} min`)
    window.setTimeout(() => {
      void closeWindow()
    }, 600)
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
        <h1>Recordatorio</h1>
      </header>
      <div className="reminder-body">
        <h2>{data.title || 'Evento'}</h2>
        <p className="reminder-time">{data.timeLabel}</p>
        <p className="reminder-cal">{data.calendarName}</p>
        {data.description && <p className="reminder-desc">{data.description}</p>}
        {message && <p className="muted">{message}</p>}
      </div>
      <footer className="reminder-actions">
        <button type="button" className="btn" onClick={() => void snooze(5)}>
          5 min
        </button>
        <button type="button" className="btn" onClick={() => void snooze(10)}>
          10 min
        </button>
        <button type="button" className="btn" onClick={() => void snooze(15)}>
          15 min
        </button>
        <button type="button" className="btn primary" onClick={() => void closeWindow()}>
          Descartar
        </button>
      </footer>
    </div>
  )
}
