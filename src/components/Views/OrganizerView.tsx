import { useMemo, useState } from 'react'
import { subDays } from 'date-fns'
import { kindColor, kindGlyph, kindLabel, taskStatusLabel } from '../../domain/eventKind'
import { buildOrganizerItems, type OrganizerEntry } from '../../domain/organizer'
import type {
  Calendar,
  CalendarEvent,
  EventException,
  EventKind,
  Occurrence,
  TaskStatus,
} from '../../types'

type Props = {
  events: CalendarEvent[]
  calendars: Calendar[]
  exceptions: EventException[]
  onOpenOccurrence: (occurrence: Occurrence) => void
  onDeleteOccurrence: (occurrence: Occurrence) => void
}

type PeriodicityFilter = 'all' | 'recurring' | 'single'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
})
const shortDateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function groupByDate(entries: OrganizerEntry[]): { key: string; date: Date; entries: OrganizerEntry[] }[] {
  const groups = new Map<string, { date: Date; entries: OrganizerEntry[] }>()
  for (const entry of entries) {
    const key = dateKey(entry.occurrence.startsAt)
    const existing = groups.get(key)
    if (existing) {
      existing.entries.push(entry)
    } else {
      groups.set(key, { date: entry.occurrence.startsAt, entries: [entry] })
    }
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }))
}

function OrganizerRow({
  entry,
  onOpen,
  onDelete,
}: {
  entry: OrganizerEntry
  onOpen: () => void
  onDelete: () => void
}) {
  const { occurrence, master, calendar } = entry
  const color = kindColor(occurrence.kind, occurrence.color)
  const time = occurrence.allDay
    ? 'Todo el día'
    : `${timeFormatter.format(occurrence.startsAt)} – ${timeFormatter.format(occurrence.endsAt)}`

  return (
    <article className={`organizer-row kind-${occurrence.kind}`}>
      <span className="organizer-swatch" style={{ background: color }} aria-hidden="true" />
      <button type="button" className="organizer-row-main" onClick={onOpen}>
        <span className="organizer-row-time">{time}</span>
        <strong className="organizer-row-title">
          <span aria-hidden="true">{kindGlyph(occurrence.kind)}</span> {occurrence.title}
        </strong>
        <span className="organizer-badges">
          <span className="organizer-badge">{kindLabel(occurrence.kind)}</span>
          {occurrence.isRecurring && <span className="organizer-badge recurring">Periódico</span>}
          {occurrence.kind === 'task' && (
            <span className={`organizer-badge task-${occurrence.taskStatus ?? 'pending'}`}>
              {taskStatusLabel(occurrence.taskStatus)}
            </span>
          )}
        </span>
        <span className="organizer-row-meta">
          <span className="calendar-dot" style={{ background: calendar.color }} aria-hidden="true" />
          {calendar.name}
          {entry.recurrenceLabel && <> · {entry.recurrenceLabel}</>}
          {occurrence.isRecurring && (
            <>
              {' · '}
              {entry.recurrenceEndsAt
                ? `Finaliza: ${shortDateFormatter.format(entry.recurrenceEndsAt)}`
                : 'Sin fecha de fin'}
            </>
          )}
        </span>
        {occurrence.description && (
          <span className="organizer-row-description">{occurrence.description}</span>
        )}
        {master.kind === 'task' && master.task_note && (
          <span className="organizer-row-description">Nota: {master.task_note}</span>
        )}
      </button>
      <div className="organizer-row-actions">
        <button type="button" className="btn" onClick={onOpen}>
          Editar
        </button>
        <button type="button" className="btn danger" onClick={onDelete}>
          Eliminar
        </button>
      </div>
    </article>
  )
}

export function OrganizerView({
  events,
  calendars,
  exceptions,
  onOpenOccurrence,
  onDeleteOccurrence,
}: Props) {
  const [referenceTime] = useState(() => new Date())
  const [pastDays, setPastDays] = useState(90)
  const [pastOpen, setPastOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | EventKind>('all')
  const [calendarId, setCalendarId] = useState('all')
  const [periodicity, setPeriodicity] = useState<PeriodicityFilter>('all')
  const [taskStatus, setTaskStatus] = useState<'all' | TaskStatus>('all')

  const items = useMemo(
    () =>
      buildOrganizerItems(
        events,
        calendars,
        exceptions,
        referenceTime,
        subDays(referenceTime, pastDays),
      ),
    [events, calendars, exceptions, referenceTime, pastDays],
  )

  const filterEntry = (entry: OrganizerEntry) => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es')
    if (
      normalizedQuery &&
      !`${entry.occurrence.title} ${entry.occurrence.description}`
        .toLocaleLowerCase('es')
        .includes(normalizedQuery)
    ) {
      return false
    }
    if (kind !== 'all' && entry.occurrence.kind !== kind) return false
    if (calendarId !== 'all' && entry.occurrence.calendarId !== calendarId) return false
    if (periodicity === 'recurring' && !entry.occurrence.isRecurring) return false
    if (periodicity === 'single' && entry.occurrence.isRecurring) return false
    if (
      taskStatus !== 'all' &&
      (entry.occurrence.kind !== 'task' || entry.occurrence.taskStatus !== taskStatus)
    ) {
      return false
    }
    return true
  }

  const upcomingGroups = groupByDate(items.upcoming.filter(filterEntry))
  const pastGroups = groupByDate(items.past.filter(filterEntry))
  const hasFilters =
    query.trim() ||
    kind !== 'all' ||
    calendarId !== 'all' ||
    periodicity !== 'all' ||
    taskStatus !== 'all'

  return (
    <section className="organizer-view" aria-labelledby="organizer-title">
      <header className="organizer-header">
        <div>
          <h2 id="organizer-title">Organizador de eventos</h2>
          <p>Próximos eventos y una sola aparición por cada serie periódica.</p>
        </div>
        <button
          type="button"
          className="btn"
          disabled={!hasFilters}
          onClick={() => {
            setQuery('')
            setKind('all')
            setCalendarId('all')
            setPeriodicity('all')
            setTaskStatus('all')
          }}
        >
          Limpiar filtros
        </button>
      </header>

      <div className="organizer-filters" aria-label="Filtros del organizador">
        <label className="organizer-search">
          Buscar
          <input
            type="search"
            value={query}
            placeholder="Título o descripción"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Tipo
          <select value={kind} onChange={(event) => setKind(event.target.value as 'all' | EventKind)}>
            <option value="all">Todos</option>
            <option value="event">Eventos</option>
            <option value="reminder">Recordatorios</option>
            <option value="task">Tareas</option>
          </select>
        </label>
        <label>
          Calendario
          <select value={calendarId} onChange={(event) => setCalendarId(event.target.value)}>
            <option value="all">Todos los visibles</option>
            {calendars
              .filter((calendar) => calendar.visible)
              .map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Periodicidad
          <select
            value={periodicity}
            onChange={(event) => setPeriodicity(event.target.value as PeriodicityFilter)}
          >
            <option value="all">Todas</option>
            <option value="recurring">Periódicos</option>
            <option value="single">No periódicos</option>
          </select>
        </label>
        <label>
          Estado de tarea
          <select
            value={taskStatus}
            onChange={(event) => setTaskStatus(event.target.value as 'all' | TaskStatus)}
          >
            <option value="all">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En curso</option>
            <option value="done">Terminada</option>
          </select>
        </label>
      </div>

      <section className="organizer-section" aria-labelledby="upcoming-title">
        <h3 id="upcoming-title">Próximos ({items.upcoming.filter(filterEntry).length})</h3>
        {upcomingGroups.length === 0 ? (
          <p className="organizer-empty">
            {hasFilters ? 'No hay próximos eventos que coincidan con los filtros.' : 'No hay próximos eventos.'}
          </p>
        ) : (
          upcomingGroups.map((group) => (
            <div className="organizer-day" key={group.key}>
              <h4>{dateFormatter.format(group.date)}</h4>
              <div className="organizer-list">
                {group.entries.map((entry) => (
                  <OrganizerRow
                    key={`${entry.occurrence.eventId}-${entry.occurrence.originalStartsAt.toISOString()}`}
                    entry={entry}
                    onOpen={() => onOpenOccurrence(entry.occurrence)}
                    onDelete={() => onDeleteOccurrence(entry.occurrence)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="organizer-section organizer-past" aria-labelledby="past-title">
        <button
          id="past-title"
          type="button"
          className="organizer-past-toggle"
          aria-expanded={pastOpen}
          onClick={() => setPastOpen((open) => !open)}
        >
          <span aria-hidden="true">{pastOpen ? '▾' : '▸'}</span>
          Anteriores · últimos {pastDays} días ({items.past.filter(filterEntry).length})
        </button>
        {pastOpen && (
          <>
            {pastGroups.length === 0 ? (
              <p className="organizer-empty">No hay eventos anteriores en este período.</p>
            ) : (
              pastGroups.map((group) => (
                <div className="organizer-day" key={group.key}>
                  <h4>{dateFormatter.format(group.date)}</h4>
                  <div className="organizer-list">
                    {group.entries.map((entry) => (
                      <OrganizerRow
                        key={`${entry.occurrence.eventId}-${entry.occurrence.originalStartsAt.toISOString()}`}
                        entry={entry}
                        onOpen={() => onOpenOccurrence(entry.occurrence)}
                        onDelete={() => onDeleteOccurrence(entry.occurrence)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
            <button type="button" className="btn organizer-load-more" onClick={() => setPastDays((days) => days + 90)}>
              Cargar 90 días más
            </button>
          </>
        )}
      </section>
    </section>
  )
}
