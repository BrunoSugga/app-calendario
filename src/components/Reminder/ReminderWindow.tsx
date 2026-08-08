import { useEffect, useMemo, useState } from 'react'
import { addMinutes, formatISO } from 'date-fns'
import { kindLabel } from '../../domain/eventKind'
import { clearFiredForEvent, clearReminderStateForEvent } from '../../domain/reschedule'
import {
  consumeReminderPayload,
  isTauri,
  notifyMainOpenEvent,
  notifyMainRescheduleEvent,
  notifyMainStartTask,
  type ReminderPayload,
} from '../../lib/tauri'
import { isSafeId, isSafeReminderToken } from '../../lib/security'

const SNOOZE_THRESHOLD_MINUTES = 12 * 60

const SHORT_OPTIONS = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '3 horas', minutes: 180 },
  { label: '6 horas', minutes: 360 },
  { label: '12 horas', minutes: 720 },
] as const

const LONG_OPTIONS = [
  { label: '1 día', minutes: 24 * 60 },
  { label: '2 días', minutes: 2 * 24 * 60 },
  { label: '3 días', minutes: 3 * 24 * 60 },
  { label: '1 semana', minutes: 7 * 24 * 60 },
  { label: '2 semanas', minutes: 14 * 24 * 60 },
  { label: '1 mes', minutes: 30 * 24 * 60 },
] as const

type DelayOption = { label: string; minutes: number }

function loadReminder(): ReminderPayload | null {
  const token = new URLSearchParams(window.location.search).get('t') ?? ''
  if (!isSafeReminderToken(token)) return null
  return consumeReminderPayload(token)
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

function toLocalInput(value: string | Date): string {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function SnoozeStepper({
  options,
  index,
  onIndexChange,
  onApply,
  disabled,
}: {
  options: readonly DelayOption[]
  index: number
  onIndexChange: (next: number) => void
  onApply: () => void
  disabled?: boolean
}) {
  const current = options[index] ?? options[0]
  const atMin = index <= 0
  const atMax = index >= options.length - 1

  return (
    <div className="snooze-stepper">
      <button
        type="button"
        className="btn snooze-stepper-arrow"
        aria-label="Disminuir"
        disabled={disabled || atMin}
        onClick={() => onIndexChange(Math.max(0, index - 1))}
      >
        ▾
      </button>
      <button
        type="button"
        className="btn snooze-stepper-value"
        disabled={disabled}
        onClick={onApply}
        title={`Aplazar ${current.label}`}
      >
        {current.label}
      </button>
      <button
        type="button"
        className="btn snooze-stepper-arrow"
        aria-label="Aumentar"
        disabled={disabled || atMax}
        onClick={() => onIndexChange(Math.min(options.length - 1, index + 1))}
      >
        ▴
      </button>
    </div>
  )
}

export function ReminderWindow() {
  const data = useMemo(() => loadReminder(), [])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shortIndex, setShortIndex] = useState(0)
  const [longIndex, setLongIndex] = useState(0)
  const [showReschedule, setShowReschedule] = useState(false)
  const [customAt, setCustomAt] = useState(() =>
    data?.startsAt ? toLocalInput(data.startsAt) : toLocalInput(new Date()),
  )

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
    if (!data?.eventId || !isSafeId(data.eventId)) return
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > SNOOZE_THRESHOLD_MINUTES) return
    const until = Date.now() + minutes * 60 * 1000
    clearFiredForEvent(data.eventId)
    localStorage.setItem(`calendario.snooze.${data.eventId}`, String(until))
    setMessage(
      `Pospuesto ${SHORT_OPTIONS.find((o) => o.minutes === minutes)?.label ?? `${minutes} min`}`,
    )
    window.setTimeout(() => {
      void closeWindow()
    }, 600)
  }

  async function rescheduleTo(newStartsAt: Date, label: string) {
    if (!data?.eventId || !isSafeId(data.eventId)) return
    if (Number.isNaN(newStartsAt.getTime())) {
      setMessage('Fecha u hora inválida')
      return
    }
    setBusy(true)
    clearReminderStateForEvent(data.eventId)
    await notifyMainRescheduleEvent({
      eventId: data.eventId,
      originalStartsAt: data.originalStartsAt || data.startsAt,
      newStartsAt: formatISO(newStartsAt),
    })
    setMessage(`Reagendado: ${label}`)
    window.setTimeout(() => {
      void closeWindow()
    }, 600)
  }

  async function applyShort() {
    const opt = SHORT_OPTIONS[shortIndex] ?? SHORT_OPTIONS[0]
    await snooze(opt.minutes)
  }

  async function applyLong() {
    if (!data) return
    const opt = LONG_OPTIONS[longIndex] ?? LONG_OPTIONS[0]
    const base = new Date(data.startsAt)
    const next = addMinutes(base, opt.minutes)
    await rescheduleTo(next, opt.label)
  }

  async function applyCustom() {
    if (!customAt) {
      setMessage('Elegí fecha y hora')
      return
    }
    const next = new Date(customAt)
    await rescheduleTo(next, 'fecha personalizada')
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
          <SnoozeStepper
            options={SHORT_OPTIONS}
            index={shortIndex}
            onIndexChange={setShortIndex}
            onApply={() => void applyShort()}
            disabled={busy}
          />
          <SnoozeStepper
            options={LONG_OPTIONS}
            index={longIndex}
            onIndexChange={setLongIndex}
            onApply={() => void applyLong()}
            disabled={busy}
          />
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => setShowReschedule((v) => !v)}
          >
            Reagendar
          </button>
        </div>
        {showReschedule && (
          <div className="reschedule-panel">
            <label>
              Nueva fecha y hora
              <input
                type="datetime-local"
                value={customAt}
                onChange={(e) => setCustomAt(e.target.value)}
                disabled={busy}
              />
            </label>
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void applyCustom()}
            >
              Confirmar
            </button>
          </div>
        )}
        <div className="reminder-main-actions">
          {data.kind === 'task' && (
            <button type="button" className="btn primary" disabled={busy} onClick={() => void startTask()}>
              Empezar tarea
            </button>
          )}
          <button type="button" className="btn" disabled={busy} onClick={() => void openInCalendar()}>
            Abrir en calendario
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void closeWindow()}>
            Descartar
          </button>
        </div>
      </footer>
    </div>
  )
}
