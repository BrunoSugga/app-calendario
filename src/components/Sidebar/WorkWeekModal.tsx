import { useEffect, useState, type FormEvent } from 'react'
import { useCalendarData } from '../../context/CalendarDataContext'
import {
  assertValidWorkWeekSettings,
  DEFAULT_WORK_WEEK,
  minutesToTimeInput,
  timeInputToMinutes,
  WORK_DAY_LABELS,
  type IsoWeekday,
  type WorkWeekSettings,
} from '../../domain/workWeek'

type Props = {
  open: boolean
  onClose: () => void
}

export function WorkWeekModal({ open, onClose }: Props) {
  const { calendars, workWeek, saveWorkWeek } = useCalendarData()
  const [workCalendarId, setWorkCalendarId] = useState<string>('')
  const [workDays, setWorkDays] = useState<IsoWeekday[]>([...DEFAULT_WORK_WEEK.workDays])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [muteOutsideHours, setMuteOutsideHours] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setWorkCalendarId(workWeek.workCalendarId ?? '')
    setWorkDays(
      workWeek.workDays.length > 0 ? [...workWeek.workDays] : [...DEFAULT_WORK_WEEK.workDays],
    )
    setStartTime(minutesToTimeInput(workWeek.startMinute))
    setEndTime(minutesToTimeInput(workWeek.endMinute))
    setMuteOutsideHours(workWeek.muteOutsideHours)
    setError(null)
  }, [open, workWeek])

  if (!open) return null

  function toggleDay(day: IsoWeekday) {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const startMinute = timeInputToMinutes(startTime)
      const endMinute = timeInputToMinutes(endTime)
      if (startMinute == null || endMinute == null) {
        throw new Error('Horario inválido')
      }
      const next: WorkWeekSettings = {
        workCalendarId: workCalendarId || null,
        workDays,
        startMinute,
        endMinute,
        muteOutsideHours,
      }
      assertValidWorkWeekSettings(next)
      if (muteOutsideHours && !next.workCalendarId) {
        throw new Error('Elegí un calendario laboral para silenciar avisos fuera de jornada')
      }
      await saveWorkWeek(next)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="modal work-week-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void onSubmit(e)}
      >
        <h2>Semana laboral</h2>
        <p className="login-sub">
          Definí tu jornada y, si querés, silenciá solo los avisos del calendario laboral fuera de
          ese horario.
        </p>

        <label>
          Calendario laboral
          <select
            value={workCalendarId}
            onChange={(e) => setWorkCalendarId(e.target.value)}
          >
            <option value="">Sin asignar</option>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="work-days">
          <legend>Días laborales</legend>
          <div className="work-days-row" role="group" aria-label="Días laborales">
            {WORK_DAY_LABELS.map(({ day, short }) => {
              const active = workDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  className={active ? 'work-day-chip active' : 'work-day-chip'}
                  aria-pressed={active}
                  onClick={() => toggleDay(day)}
                >
                  {short}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="work-hours-row">
          <label>
            Desde
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
        </div>

        <label className="checkbox work-week-mute">
          <input
            type="checkbox"
            checked={muteOutsideHours}
            onChange={(e) => setMuteOutsideHours(e.target.checked)}
          />
          No molestar fuera del horario laboral
        </label>
        <p className="hint">
          Los avisos de ese calendario esperan al próximo inicio de jornada. Los demás calendarios
          siguen sonando con normalidad.
        </p>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
