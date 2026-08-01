import { useMemo, useState } from 'react'
import { isTauri } from '../../lib/tauri'

function paramsFromUrl(): Record<string, string> {
  const params = new URLSearchParams(window.location.search)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
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
  const data = useMemo(() => paramsFromUrl(), [])
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
    const eventId = data.eventId ?? 'x'
    const until = Date.now() + minutes * 60 * 1000
    localStorage.setItem(`calendario.snooze.${eventId}`, String(until))
    clearFiredForEvent(eventId)
    setMessage(`Pospuesto ${minutes} min`)
    window.setTimeout(() => {
      void closeWindow()
    }, 600)
  }

  return (
    <div className="reminder-window">
      <header>
        <h1>Recordatorio</h1>
      </header>
      <div className="reminder-body">
        <h2>{data.title || 'Evento'}</h2>
        <p className="reminder-time">{data.time}</p>
        <p className="reminder-cal">{data.calendar}</p>
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
