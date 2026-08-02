import { useMemo, useState } from 'react'
import { addMinutes, formatISO } from 'date-fns'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { Toolbar } from '../components/Toolbar/Toolbar'
import { DayView } from '../components/Views/DayView'
import { WeekView } from '../components/Views/WeekView'
import { MonthView } from '../components/Views/MonthView'
import { EventModal } from '../components/Event/EventModal'
import { useCalendarData } from '../context/CalendarDataContext'
import { useReminders } from '../hooks/useReminders'
import { useAppUpdater } from '../hooks/useAppUpdater'
import { dayRange, monthGridRange, navigateView, startOfDay, weekRange } from '../domain/dates'
import { expandOccurrences } from '../domain/recurrence'
import type { EventDraft, Occurrence, ViewMode } from '../types'

export function CalendarPage() {
  const { calendars, events, exceptions, loading, error, saveEvent, deleteEvent } =
    useCalendarData()
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [view, setView] = useState<ViewMode>('day')
  const [zoom, setZoom] = useState(100)
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<
    (Partial<EventDraft> & { occurrence?: Occurrence; master?: (typeof events)[number] }) | undefined
  >()

  useReminders()
  useAppUpdater()

  const range = useMemo(() => {
    if (view === 'day') return dayRange(selectedDate)
    if (view === 'week') return weekRange(selectedDate)
    return monthGridRange(selectedDate)
  }, [view, selectedDate])

  const occurrences = useMemo(
    () => expandOccurrences(events, calendars, exceptions, range.start, range.end),
    [events, calendars, exceptions, range],
  )

  function openNewAt(slot: Date) {
    const defaultCal = calendars.find((c) => c.is_default) ?? calendars[0]
    setDraft({
      calendar_id: defaultCal?.id,
      title: '',
      description: '',
      starts_at: formatISO(slot),
      ends_at: formatISO(addMinutes(slot, 30)),
      all_day: false,
      reminder_minutes: 15,
      rrule: null,
    })
    setModalOpen(true)
  }

  function openOccurrence(occ: Occurrence) {
    const master = events.find((e) => e.id === occ.eventId)
    setDraft({
      id: occ.eventId,
      calendar_id: occ.calendarId,
      title: occ.title,
      description: occ.description,
      starts_at: formatISO(occ.startsAt),
      ends_at: formatISO(occ.endsAt),
      all_day: occ.allDay,
      reminder_minutes: occ.reminderMinutes,
      rrule: master?.rrule ?? null,
      occurrence: occ,
      master,
    })
    setModalOpen(true)
  }

  return (
    <div className="app-shell">
      <Sidebar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onOpenOccurrence={openOccurrence}
      />
      <main className="main-pane">
        <Toolbar
          view={view}
          selectedDate={selectedDate}
          zoom={zoom}
          onViewChange={setView}
          onNavigate={(delta) => setSelectedDate((d) => navigateView(d, view, delta))}
          onToday={() => setSelectedDate(startOfDay(new Date()))}
          onZoom={(delta) => setZoom((z) => Math.min(160, Math.max(70, z + delta * 10)))}
        />
        {error && <div className="banner error">{error}</div>}
        {loading && <div className="banner">Cargando…</div>}
        <div className="view-container">
          {view === 'day' && (
            <DayView
              date={selectedDate}
              occurrences={occurrences}
              zoom={zoom}
              onSlotClick={openNewAt}
              onOccurrenceClick={openOccurrence}
            />
          )}
          {view === 'week' && (
            <WeekView
              date={selectedDate}
              occurrences={occurrences}
              zoom={zoom}
              onSlotClick={openNewAt}
              onOccurrenceClick={openOccurrence}
            />
          )}
          {view === 'month' && (
            <MonthView
              date={selectedDate}
              occurrences={occurrences}
              onSelectDate={setSelectedDate}
              onOccurrenceClick={openOccurrence}
              onDayDoubleClick={(d) => {
                setSelectedDate(d)
                setView('day')
                openNewAt(d)
              }}
            />
          )}
        </div>
      </main>

      <EventModal
        open={modalOpen}
        calendars={calendars}
        initial={draft}
        onClose={() => setModalOpen(false)}
        onSave={saveEvent}
        onDelete={
          draft?.id
            ? async (scope) => {
                await deleteEvent(
                  draft.id!,
                  scope,
                  draft.occurrence ? formatISO(draft.occurrence.originalStartsAt) : undefined,
                )
              }
            : undefined
        }
      />
    </div>
  )
}
