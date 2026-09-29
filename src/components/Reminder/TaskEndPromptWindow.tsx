import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  consumeTaskEndPayload,
  isTauri,
  notifyMainCompleteTask,
  notifyMainExtendTaskEnd,
  queueTaskEndClosed,
  type TaskEndPromptPayload,
} from '../../lib/tauri'
import { isCapacitor } from '../../lib/platform'
import { isSafeId, isSafeReminderToken } from '../../lib/security'

function loadPrompt(tokenOverride?: string): Omit<TaskEndPromptPayload, 'exp'> | null {
  const token = tokenOverride ?? new URLSearchParams(window.location.search).get('t') ?? ''
  if (!isSafeReminderToken(token)) return null
  const data = consumeTaskEndPayload(token)
  if (!data) return null
  return { eventId: data.eventId, title: data.title, endsAt: data.endsAt }
}

function playPromptSound(): void {
  try {
    const muted = localStorage.getItem('calendario.reminder.mute') === '1'
    if (muted) return
    const audio = new Audio(`${import.meta.env.BASE_URL}sounds/reminder.wav`)
    audio.volume = 0.75
    void audio.play().catch(() => {
      // autoplay may be blocked
    })
  } catch {
    // ignore
  }
}

export function TaskEndPromptWindow({
  token,
  initial,
  onYes,
  onNo,
  onDismiss,
}: {
  token?: string
  initial?: Omit<TaskEndPromptPayload, 'exp'>
  onYes?: (eventId: string) => void
  onNo?: (eventId: string) => void
  onDismiss?: () => void
} = {}) {
  const data = useMemo(() => initial ?? loadPrompt(token), [initial, token])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const answeredRef = useRef(false)

  useEffect(() => {
    if (data) playPromptSound()
  }, [data])

  useEffect(() => {
    if (!data || onYes || onNo) return
    function onLeave() {
      if (!answeredRef.current && data) queueTaskEndClosed(data.eventId)
    }
    window.addEventListener('pagehide', onLeave)
    return () => window.removeEventListener('pagehide', onLeave)
  }, [data, onYes, onNo])

  async function closeWindow() {
    if (onDismiss) {
      onDismiss()
      return
    }
    if (isCapacitor()) return
    if (!isTauri()) {
      window.close()
      return
    }
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().close()
  }

  async function answer(finished: boolean) {
    if (!data || !isSafeId(data.eventId) || answeredRef.current) return
    answeredRef.current = true
    setBusy(true)
    try {
      if (finished) {
        if (onYes) onYes(data.eventId)
        else await notifyMainCompleteTask(data.eventId)
        setMessage('Tarea terminada')
      } else {
        if (onNo) onNo(data.eventId)
        else await notifyMainExtendTaskEnd(data.eventId)
        setMessage('Hora de fin extendida una hora')
      }
      window.setTimeout(() => {
        void closeWindow()
      }, 500)
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return (
      <div className="reminder-window">
        <header>
          <h1>Tarea</h1>
        </header>
        <div className="reminder-body">
          <p className="form-error">El aviso expiró o no es válido.</p>
        </div>
        <footer className="reminder-actions">
          <button type="button" className="btn primary" onClick={() => void closeWindow()}>
            Cerrar
          </button>
        </footer>
      </div>
    )
  }

  const end = new Date(data.endsAt)
  const endLabel = Number.isNaN(end.getTime()) ? '' : format(end, 'HH:mm')

  return (
    <div className="reminder-window">
      <header>
        <h1>Tarea en curso</h1>
      </header>
      <div className="reminder-body">
        <h2>{data.title || 'Sin título'}</h2>
        {endLabel && <p className="reminder-time">Hora de fin: {endLabel}</p>}
        <p>¿Ya terminaste esta tarea?</p>
        {message && <p className="muted">{message}</p>}
      </div>
      <footer className="reminder-actions">
        <div className="reminder-main-actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void answer(true)}
          >
            Sí, ya terminó
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void answer(false)}>
            No, una hora más
          </button>
        </div>
      </footer>
    </div>
  )
}
