import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addMinutes, formatISO } from 'date-fns'
import type {
  Calendar,
  CalendarEvent,
  EventDraft,
  EventKind,
  Occurrence,
  TaskRun,
} from '../../types'
import {
  WEEKDAY_OPTIONS,
  buildRRule,
  jsDateToWeekdayIndex,
  presetFromRRule,
  weekdaysFromRRule,
  type RecurrencePreset,
  type WeekdayIndex,
} from '../../domain/recurrence'
import { formatDuration, kindLabel, taskStatusLabel } from '../../domain/eventKind'

type Props = {
  open: boolean
  calendars: Calendar[]
  events?: CalendarEvent[]
  taskRuns?: TaskRun[]
  initial?: Partial<EventDraft> & { occurrence?: Occurrence; master?: CalendarEvent }
  onClose: () => void
  onSave: (draft: EventDraft) => Promise<void>
  onDelete?: (scope: 'single' | 'series') => Promise<void>
  onStartTask?: (eventId: string) => Promise<void>
  onCompleteTask?: (eventId: string, note: string) => Promise<void>
}

function toLocalInput(value: string | Date | undefined, fallback: Date): string {
  const date = value ? new Date(value) : fallback
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function EventModal({
  open,
  calendars,
  events = [],
  taskRuns = [],
  initial,
  onClose,
  onSave,
  onDelete,
  onStartTask,
  onCompleteTask,
}: Props) {
  const defaultCal = calendars.find((c) => c.is_default) ?? calendars[0]
  const [kind, setKind] = useState<EventKind>('event')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [reminder, setReminder] = useState(15)
  const [recurrence, setRecurrence] = useState<RecurrencePreset>('none')
  const [weekdays, setWeekdays] = useState<WeekdayIndex[]>([])
  const [editScope, setEditScope] = useState<'single' | 'series'>('series')
  const [completeNote, setCompleteNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = Boolean(initial?.id)
  const isRecurring = Boolean(initial?.master?.rrule || initial?.occurrence?.isRecurring)
  const showDayPicker = recurrence === 'weekly' || recurrence === 'monthly'
  const master = useMemo(() => {
    if (!initial?.id) return initial?.master
    return events.find((e) => e.id === initial.id) ?? initial.master
  }, [events, initial?.id, initial?.master])
  const isReminder = kind === 'reminder'
  const isTask = kind === 'task'

  const runsForEvent = useMemo(
    () => (initial?.id ? taskRuns.filter((r) => r.event_id === initial.id).slice(0, 5) : []),
    [taskRuns, initial?.id],
  )

  useEffect(() => {
    if (!open) return
    const start = initial?.starts_at
      ? new Date(initial.starts_at)
      : initial?.occurrence?.startsAt ?? new Date()
    const end = initial?.ends_at
      ? new Date(initial.ends_at)
      : initial?.occurrence?.endsAt ?? addMinutes(start, 30)
    const rrule = initial?.rrule ?? initial?.master?.rrule ?? null
    const nextKind =
      initial?.kind ?? initial?.master?.kind ?? initial?.occurrence?.kind ?? 'event'

    setKind(nextKind)
    setTitle(initial?.title ?? initial?.occurrence?.title ?? '')
    setDescription(initial?.description ?? initial?.occurrence?.description ?? '')
    setCalendarId(initial?.calendar_id ?? initial?.occurrence?.calendarId ?? defaultCal?.id ?? '')
    setStartsAt(toLocalInput(start, start))
    setEndsAt(toLocalInput(nextKind === 'reminder' ? start : end, end))
    setAllDay(nextKind === 'reminder' ? false : (initial?.all_day ?? initial?.occurrence?.allDay ?? false))
    setReminder(initial?.reminder_minutes ?? initial?.occurrence?.reminderMinutes ?? 15)
    setRecurrence(presetFromRRule(rrule))
    setWeekdays(weekdaysFromRRule(rrule, start))
    setEditScope(isRecurring ? 'single' : 'series')
    setCompleteNote(initial?.master?.task_note ?? '')
    setError(null)
  }, [open, initial, defaultCal, isRecurring])

  function toggleWeekday(index: WeekdayIndex) {
    setWeekdays((prev) => {
      if (prev.includes(index)) {
        if (prev.length === 1) return prev
        return prev.filter((d) => d !== index).sort((a, b) => a - b)
      }
      return [...prev, index].sort((a, b) => a - b)
    })
  }

  function onRecurrenceChange(value: RecurrencePreset) {
    setRecurrence(value)
    if (value === 'weekly' || value === 'monthly') {
      setWeekdays((prev) => {
        if (prev.length > 0) return prev
        const start = startsAt ? new Date(startsAt) : new Date()
        return [jsDateToWeekdayIndex(start)]
      })
    }
  }

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('El título es obligatorio')
      return
    }
    if (showDayPicker && weekdays.length === 0) {
      setError('Elegí al menos un día de la semana')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const startDate = new Date(startsAt)
      const endDate = kind === 'reminder' ? startDate : new Date(endsAt)
      const rrule =
        isEdit && editScope === 'single'
          ? initial?.master?.rrule ?? null
          : buildRRule(recurrence, startDate, weekdays)

      await onSave({
        id: initial?.id,
        calendar_id: calendarId,
        title: title.trim(),
        description: description.trim(),
        starts_at: formatISO(startDate),
        ends_at: formatISO(endDate),
        all_day: kind === 'reminder' ? false : allDay,
        reminder_minutes: reminder,
        rrule: isEdit && editScope === 'single' ? initial?.master?.rrule ?? null : rrule,
        kind,
        occurrenceOriginalStartsAt: initial?.occurrence
          ? formatISO(initial.occurrence.originalStartsAt)
          : undefined,
        editScope: isEdit && isRecurring ? editScope : 'series',
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  const canCompleteTask =
    isTask && isEdit && master?.task_status === 'in_progress' && Boolean(onCompleteTask)

  async function handleCompleteTask() {
    if (!master || !onCompleteTask) return
    setBusy(true)
    setError(null)
    try {
      await onCompleteTask(master.id, completeNote)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo terminar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <header className="modal-header">
          <h2>{isEdit ? `Editar ${kindLabel(kind).toLowerCase()}` : `Nuevo ${kindLabel(kind).toLowerCase()}`}</h2>
          <button type="button" className="btn icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="modal-body">
        <label>
          Tipo
          <select
            value={kind}
            onChange={(e) => {
              const next = e.target.value as EventKind
              setKind(next)
              if (next === 'reminder') {
                setEndsAt(startsAt)
                setAllDay(false)
              }
            }}
            disabled={isEdit && isRecurring && editScope === 'single'}
          >
            <option value="event">Evento</option>
            <option value="reminder">Recordatorio</option>
            <option value="task">Tarea</option>
          </select>
        </label>

        <label>
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>

        <label>
          Calendario
          <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-row">
          <label>
            {isReminder ? 'Fecha y hora' : 'Inicio'}
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => {
                setStartsAt(e.target.value)
                if (isReminder) setEndsAt(e.target.value)
              }}
            />
          </label>
          {!isReminder && (
            <label>
              Fin
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
          )}
        </div>

        {!isReminder && (
          <label className="checkbox">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            Todo el día
          </label>
        )}

        <label>
          Aviso
          <select value={reminder} onChange={(e) => setReminder(Number(e.target.value))}>
            <option value={0}>Al inicio</option>
            <option value={5}>5 minutos antes</option>
            <option value={10}>10 minutos antes</option>
            <option value={15}>15 minutos antes</option>
            <option value={30}>30 minutos antes</option>
            <option value={60}>1 hora antes</option>
          </select>
        </label>

        {(!isEdit || editScope === 'series') && (
          <>
            <label>
              Repetición
              <select
                value={recurrence}
                onChange={(e) => onRecurrenceChange(e.target.value as RecurrencePreset)}
              >
                <option value="none">No se repite</option>
                <option value="daily">Diariamente</option>
                <option value="weekly">Semanalmente</option>
                <option value="monthly">Mensualmente</option>
              </select>
            </label>

            {showDayPicker && (
              <fieldset className="weekday-fieldset">
                <legend>Días de la semana</legend>
                <div className="weekday-picker" role="group" aria-label="Días de la semana">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const active = weekdays.includes(day.index)
                    return (
                      <button
                        key={day.index}
                        type="button"
                        className={active ? 'weekday-chip active' : 'weekday-chip'}
                        aria-pressed={active}
                        title={day.label}
                        onClick={() => toggleWeekday(day.index)}
                      >
                        {day.short}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )}
          </>
        )}

        {isEdit && isRecurring && (
          <fieldset className="scope-fieldset">
            <legend>Aplicar cambios a</legend>
            <label className="checkbox">
              <input
                type="radio"
                checked={editScope === 'single'}
                onChange={() => setEditScope('single')}
              />
              Solo esta ocurrencia
            </label>
            <label className="checkbox">
              <input
                type="radio"
                checked={editScope === 'series'}
                onChange={() => setEditScope('series')}
              />
              Toda la serie
            </label>
          </fieldset>
        )}

        {!isReminder && (
          <label>
            Descripción
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        )}

        {isTask && isEdit && master && (
          <section className="task-panel">
            <h3>Estado de la tarea</h3>
            <p>
              <strong>{taskStatusLabel(master.task_status)}</strong>
              {master.task_duration_ms != null && (
                <> · Duración: {formatDuration(master.task_duration_ms)}</>
              )}
            </p>
            {master.task_note && <p className="muted">Última nota: {master.task_note}</p>}

            <div className="task-actions">
              {master.task_status !== 'in_progress' && onStartTask && (
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await onStartTask(master.id)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'No se pudo empezar')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Empezar tarea
                </button>
              )}
              {canCompleteTask && (
                <label>
                  Observación (opcional)
                  <textarea
                    rows={2}
                    value={completeNote}
                    onChange={(e) => setCompleteNote(e.target.value)}
                  />
                </label>
              )}
            </div>

            {runsForEvent.length > 0 && (
              <div className="task-history">
                <h4>Historial reciente</h4>
                <ul>
                  {runsForEvent.map((run) => (
                    <li key={run.id}>
                      {formatDuration(run.duration_ms)}
                      {run.note ? ` — ${run.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-footer">
          {isEdit && onDelete && (
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onDelete(isRecurring ? editScope : 'series')
                  onClose()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'No se pudo eliminar')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Eliminar
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          {canCompleteTask && (
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void handleCompleteTask()}
            >
              Tarea terminada
            </button>
          )}
          <button type="submit" className="btn" disabled={busy}>
            Guardar
          </button>
        </footer>
      </form>
    </div>
  )
}
