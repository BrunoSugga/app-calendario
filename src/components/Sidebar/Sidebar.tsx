import { addMonths } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import { endOfDay, formatDayHeader, formatTime, startOfDay } from '../../domain/dates'
import { expandOccurrences, labelForRRule } from '../../domain/recurrence'
import { kindColor, kindGlyph, taskStatusLabel } from '../../domain/eventKind'
import { useAuth } from '../../context/AuthContext'
import { useCalendarData } from '../../context/CalendarDataContext'
import { getAutostartEnabled, setAutostartEnabled } from '../../lib/autostart'
import { isTauri } from '../../lib/tauri'
import { isCapacitor } from '../../lib/platform'
import type { Occurrence } from '../../types'
import { InviteUserModal } from '../Auth/InviteUserModal'
import { ManageCalendarsModal } from './ManageCalendarsModal'
import { MiniCalendar } from './MiniCalendar'
import { WorkWeekModal } from './WorkWeekModal'

const DESKTOP_DOWNLOAD_URL =
  'https://github.com/BrunoSugga/app-calendario/releases/latest'

type Props = {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onOpenOccurrence: (occ: Occurrence) => void
  pendingTasksOnly: boolean
  onPendingTasksOnlyChange: (value: boolean) => void
  mobileOpen?: boolean
}

function SettingsGearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14.3 2h-4.6a.5.5 0 0 0-.5.42l-.36 2.54c-.6.24-1.15.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.3 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.42 14.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.48.39 1.03.7 1.63.94l.36 2.54c.05.24.26.42.5.42h4.6c.24 0 .45-.18.5-.42l.36-2.54c.6-.24 1.15-.55 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  )
}

export function Sidebar({
  selectedDate,
  onSelectDate,
  onOpenOccurrence,
  pendingTasksOnly,
  onPendingTasksOnlyChange,
  mobileOpen = false,
}: Props) {
  const { user, signOut, isCloud, isAdmin } = useAuth()
  const {
    calendars,
    events,
    exceptions,
    toggleCalendarVisible,
    setDefaultCalendar,
  } = useCalendarData()
  const [monthAnchor, setMonthAnchor] = useState(startOfDay(selectedDate))
  const [autostart, setAutostart] = useState(false)
  const [autostartMsg, setAutostartMsg] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [workWeekOpen, setWorkWeekOpen] = useState(false)
  const [manageCalsOpen, setManageCalsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const desktop = isTauri()
  const native = desktop || isCapacitor()

  useEffect(() => {
    if (!desktop) return
    void getAutostartEnabled()
      .then(setAutostart)
      .catch(() => setAutostart(false))
  }, [desktop])

  useEffect(() => {
    if (!settingsOpen) return
    function onDocPointer(ev: MouseEvent) {
      if (!settingsRef.current?.contains(ev.target as Node)) setSettingsOpen(false)
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [settingsOpen])

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
    <aside className={mobileOpen ? 'sidebar sidebar-mobile-open' : 'sidebar'} id="calendario-sidebar">
      <div className="sidebar-brand">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
        <strong>BMatrix Calendario</strong>
        <div className="sidebar-settings" ref={settingsRef}>
          <button
            type="button"
            className="btn icon sidebar-settings-btn"
            aria-label="Ajustes"
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            title="Ajustes"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <SettingsGearIcon />
          </button>
          {settingsOpen && (
            <div className="sidebar-settings-menu" role="menu">
              <button
                type="button"
                className="sidebar-settings-item"
                role="menuitem"
                onClick={() => {
                  setSettingsOpen(false)
                  setManageCalsOpen(true)
                }}
              >
                Gestionar calendarios
              </button>
              <button
                type="button"
                className="sidebar-settings-item"
                role="menuitem"
                onClick={() => {
                  setSettingsOpen(false)
                  setWorkWeekOpen(true)
                }}
              >
                Semana laboral
              </button>
              {isCloud && isAdmin && (
                <button
                  type="button"
                  className="sidebar-settings-item"
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(false)
                    setInviteOpen(true)
                  }}
                >
                  Invitar usuario
                </button>
              )}
              <button
                type="button"
                className="sidebar-settings-item"
                role="menuitem"
                onClick={() => {
                  setSettingsOpen(false)
                  void signOut()
                }}
              >
                Salir
              </button>
              <div className="sidebar-settings-version" aria-label="Versión de la aplicación">
                <span>Versión</span>
                <strong>v{import.meta.env.VITE_APP_VERSION}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="sidebar-user">
        <strong>{user?.displayName}</strong>
        <span>{isCloud ? (isAdmin ? 'Admin · Sync nube' : 'Sync nube') : 'Modo local'}</span>
      </div>
      {!native && (
        <a
          className="sidebar-download"
          href={DESKTOP_DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Descargar app para PC
        </a>
      )}

      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <WorkWeekModal open={workWeekOpen} onClose={() => setWorkWeekOpen(false)} />
      <ManageCalendarsModal open={manageCalsOpen} onClose={() => setManageCalsOpen(false)} />

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
        <p className="hint tiny">Solo en este dispositivo. Usado al crear eventos nuevos.</p>

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
