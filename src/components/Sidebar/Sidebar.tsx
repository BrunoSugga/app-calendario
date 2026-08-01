import { addMonths } from 'date-fns'
import { useMemo, useState } from 'react'
import { endOfDay, formatDayHeader, formatTime, startOfDay } from '../../domain/dates'
import { expandOccurrences, labelForRRule } from '../../domain/recurrence'
import { useAuth } from '../../context/AuthContext'
import { useCalendarData } from '../../context/CalendarDataContext'
import type { Occurrence } from '../../types'
import { MiniCalendar } from './MiniCalendar'

type Props = {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onOpenOccurrence: (occ: Occurrence) => void
}

export function Sidebar({ selectedDate, onSelectDate, onOpenOccurrence }: Props) {
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
      </section>

      <section className="sidebar-section agenda">
        <h3>{formatDayHeader(selectedDate)}</h3>
        {dayOccurrences.length === 0 && <p className="muted">Sin eventos</p>}
        <ul className="agenda-list">
          {dayOccurrences.map((occ) => {
            const master = events.find((e) => e.id === occ.eventId)
            const recur = labelForRRule(master?.rrule ?? null)
            return (
              <li key={`${occ.eventId}-${occ.originalStartsAt.toISOString()}`}>
                <button type="button" className="agenda-item" onClick={() => onOpenOccurrence(occ)}>
                  <span className="agenda-time">
                    {formatTime(occ.startsAt)} - {formatTime(occ.endsAt)}
                  </span>
                  <span className="agenda-title">
                    {occ.title}
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
