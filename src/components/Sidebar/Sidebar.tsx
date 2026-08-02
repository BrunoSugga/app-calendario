import { addMonths } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { endOfDay, formatDayHeader, formatTime, startOfDay } from '../../domain/dates'
import { expandOccurrences, labelForRRule } from '../../domain/recurrence'
import { kindColor, kindGlyph, taskStatusLabel } from '../../domain/eventKind'
import { useAuth } from '../../context/AuthContext'
import { useCalendarData } from '../../context/CalendarDataContext'
import { getAutostartEnabled, setAutostartEnabled } from '../../lib/autostart'
import { isTauri } from '../../lib/tauri'
import type { Occurrence } from '../../types'
import { MiniCalendar } from './MiniCalendar'

type Props = {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onOpenOccurrence: (occ: Occurrence) => void
  pendingTasksOnly: boolean
  onPendingTasksOnlyChange: (value: boolean) => void
}

export function Sidebar({
  selectedDate,
  onSelectDate,
  onOpenOccurrence,
  pendingTasksOnly,
  onPendingTasksOnlyChange,
}: Props) {
  const { user, signOut, isCloud } = useAuth()
  const {
    calendars,
    events,
    exceptions,
    toggleCalendarVisible,
    setDefaultCalendar,
    createCalendar,
  } = useCalendarData()
  const [monthAnchor, setMonthAnchor] = useState(startOfDay(selectedDate))
  const [newName, setNewName] = useState('')
  const [autostart, setAutostart] = useState(false)
  const [autostartMsg, setAutostartMsg] = useState<string | null>(null)
  const desktop = isTauri()

  useEffect(() => {
    if (!desktop) return
    void getAutostartEnabled()
      .then(setAutostart)
      .catch(() => setAutostart(false))
  }, [desktop])

  const dayOccurrences = useMemo(() => {
    return expandOccurrences(
      events,
      calendars,
      exceptions,
      startOfDay(selectedDate),
      endOfDay(selectedDate),
    )
  }, [events, calendars, exceptions, selectedDate])

  const defaultId = calendars.find((c) => c.is_default)?.id ?? calendars[0]?.id ?? ''

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
        <strong>BMatrix Calendario</strong>
      </div>
      <div className="sidebar-user">
        <strong>{user?.displayName}</strong>
        <span>{isCloud ? 'Sync nube' : 'Modo local'}</span>
        <button type="button" className="btn link tiny" onClick={() => void signOut()}>
          Salir
        </button>
      </div>

      <div className="mini-cal-stack">
        <MiniCalendar
          month={monthAnchor}
          selected={selectedDate}
          onSelect={onSelectDate}
          onMonthChange={setMonthAnchor}
          showNav
        />
        <MiniCalendar
          month={addMonths(monthAnchor, 1)}
          selected={selectedDate}
          onSelect={onSelectDate}
        />
      </div>

      <section className="sidebar-section">
        <h3>Calendarios</h3>
        <div className="calendar-group">
          <div className="calendar-group-title">Mis calendarios</div>
          {calendars.map((cal) => (
            <label key={cal.id} className="calendar-item">
              <input
                type="checkbox"
                checked={cal.visible}
                onChange={() => void toggleCalendarVisible(cal.id)}
              />
              <span className="cal-swatch" style={{ background: cal.color }} />
              <span className={cal.is_default ? 'cal-name active' : 'cal-name'}>{cal.name}</span>
            </label>
          ))}
        </div>

        <label className="default-cal">
          Calendario predeterminado
          <select value={defaultId} onChange={(e) => void setDefaultCalendar(e.target.value)}>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="new-cal-row">
          <input
            placeholder="Nuevo calendario"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!newName.trim()) return
              void createCalendar(newName.trim(), '#3D9BE0')
              setNewName('')
            }}
          >
            +
          </button>
        </div>

        <label className="checkbox filter-check">
          <input
            type="checkbox"
            checked={pendingTasksOnly}
            onChange={(e) => onPendingTasksOnlyChange(e.target.checked)}
          />
          Solo tareas pendientes
        </label>

        <label className="checkbox filter-check" title="Solo app de escritorio (Tauri)">
          <input
            type="checkbox"
            checked={autostart}
            disabled={!desktop}
            onChange={async (e) => {
              const next = e.target.checked
              setAutostartMsg(null)
              try {
                await setAutostartEnabled(next)
                setAutostart(next)
                setAutostartMsg(
                  next
                    ? 'Listo: la app se abrirá al iniciar Windows.'
                    : 'Autostart desactivado.',
                )
              } catch (err) {
                setAutostart(!next)
                setAutostartMsg(
                  err instanceof Error
                    ? err.message
                    : 'No se pudo cambiar el inicio con Windows. Revisá permisos del sistema.',
                )
              }
            }}
          />
          Iniciar con Windows
        </label>
        <p className="hint tiny">
          {desktop
            ? 'Solo app de escritorio. Si Windows pide permiso, aceptalo al activarlo.'
            : 'Disponible solo en la app instalada (no en el navegador).'}
        </p>
        {autostartMsg && <p className="muted tiny">{autostartMsg}</p>}
      </section>

      <section className="sidebar-section agenda">
        <h3>{formatDayHeader(selectedDate)}</h3>
        {dayOccurrences.length === 0 && <p className="muted">Sin eventos</p>}
        <ul className="agenda-list">
          {dayOccurrences.map((occ) => {
            const master = events.find((e) => e.id === occ.eventId)
            const recur = labelForRRule(master?.rrule ?? null)
            const time =
              occ.kind === 'reminder'
                ? formatTime(occ.startsAt)
                : `${formatTime(occ.startsAt)} - ${formatTime(occ.endsAt)}`
            return (
              <li key={`${occ.eventId}-${occ.originalStartsAt.toISOString()}`}>
                <button type="button" className="agenda-item" onClick={() => onOpenOccurrence(occ)}>
                  <span
                    className="agenda-swatch"
                    style={{ background: kindColor(occ.kind, occ.color) }}
                    aria-hidden
                  />
                  <span className="agenda-time">{time}</span>
                  <span className="agenda-title">
                    <span className="kind-glyph" aria-hidden>
                      {kindGlyph(occ.kind)}
                    </span>{' '}
                    {occ.title}
                    {occ.kind === 'task' ? ` [${taskStatusLabel(occ.taskStatus)}]` : ''}
                    {recur ? ` (${recur})` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </aside>
  )
}
