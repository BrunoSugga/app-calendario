import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  clearReminderStateForEvent,
  withReagendadoPrefix,
} from '../domain/reschedule'
import type { RescheduleEventPayload } from '../lib/tauri'
import type { EventDraft, Occurrence, ViewMode } from '../types'

export function CalendarPage() {
  const {
    calendars,
    events,
    exceptions,
    taskRuns,
    loading,
    error,
    saveEvent,
    deleteEvent,
    startTask,
    completeTask,
  } = useCalendarData()
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [view, setView] = useState<ViewMode>('day')
  const [zoom, setZoom] = useState(100)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingTasksOnly, setPendingTasksOnly] = useState(false)
  const [draft, setDraft] = useState<
    (Partial<EventDraft> & { occurrence?: Occurrence; master?: (typeof events)[number] }) | undefined
  >()
  const [focusEventId, setFocusEventId] = useState<string | null>(null)

  const handleReschedule = useCallback(
    async (payload: RescheduleEventPayload) => {
      const master = events.find((e) => e.id === payload.eventId)
      if (!master) return

      const originalStartsAt = new Date(payload.originalStartsAt)
      const newStartsAt = new Date(payload.newStartsAt)
      if (Number.isNaN(originalStartsAt.getTime()) || Number.isNaN(newStartsAt.getTime())) return

      const rangeStart = new Date(originalStartsAt.getTime() - 60 * 60 * 1000)
      const rangeEnd = new Date(originalStartsAt.getTime() + 60 * 60 * 1000)
      const occ =
        expandOccurrences([master], calendars, exceptions, rangeStart, rangeEnd).find(
          (o) => o.originalStartsAt.getTime() === originalStartsAt.getTime(),
        ) ??
        expandOccurrences(
          [master],
          calendars,
          exceptions,
          startOfDay(originalStartsAt),
          new Date(startOfDay(originalStartsAt).getTime() + 24 * 60 * 60 * 1000 - 1),
        ).find((o) => o.originalStartsAt.getTime() === originalStartsAt.getTime())

      const titleSource = occ?.title ?? master.title
      const description = occ?.description ?? master.description
      const allDay = occ?.allDay ?? master.all_day
      const reminderMinutes = occ?.reminderMinutes ?? master.reminder_minutes
      const kind = occ?.kind ?? master.kind
      const durationMs = occ
        ? Math.max(0, occ.endsAt.getTime() - occ.startsAt.getTime())
        : Math.max(0, new Date(master.ends_at).getTime() - new Date(master.starts_at).getTime())
      const newEndsAt =
        kind === 'reminder' ? newStartsAt : new Date(newStartsAt.getTime() + durationMs)
      const isRecurring = Boolean(master.rrule || occ?.isRecurring)

      clearReminderStateForEvent(payload.eventId)

      await saveEvent({
        id: master.id,
        calendar_id: master.calendar_id,
        title: withReagendadoPrefix(titleSource),
        description,
        starts_at: formatISO(newStartsAt),
        ends_at: formatISO(newEndsAt),
        all_day: allDay,
        reminder_minutes: reminderMinutes,
        rrule: master.rrule,
        kind,
        editScope: isRecurring ? 'single' : undefined,
        occurrenceOriginalStartsAt: isRecurring ? formatISO(originalStartsAt) : undefined,
      })

      setSelectedDate(startOfDay(newStartsAt))
      setView('day')
    },
    [calendars, events, exceptions, saveEvent],
  )

  useReminders({
    onOpenInCalendar: (payload) => {
      setSelectedDate(startOfDay(new Date(payload.startsAt)))
      setView('day')
      setFocusEventId(payload.eventId)
    },
    onStartTask: (eventId) => {
      void startTask(eventId)
    },
    onReschedule: (payload) => {
      void handleReschedule(payload)
    },
  })
  useAppUpdater()

  useEffect(() => {
    if (!focusEventId) return
    const master = events.find((e) => e.id === focusEventId)
    if (!master) return
    const occ = expandOccurrences(
      [master],
      calendars,
      exceptions,
      startOfDay(selectedDate),
      new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 1),
    )[0]
    if (!occ) return
    setDraft({
      id: occ.eventId,
      calendar_id: occ.calendarId,
      title: occ.title,
      description: occ.description,
      starts_at: formatISO(occ.startsAt),
      ends_at: formatISO(occ.endsAt),
      all_day: occ.allDay,
      reminder_minutes: occ.reminderMinutes,
      rrule: master.rrule,
      kind: occ.kind,
      occurrence: occ,
      master,
    })
    setModalOpen(true)
    setFocusEventId(null)
  }, [focusEventId, events, calendars, exceptions, selectedDate])

  const range = useMemo(() => {
    if (view === 'day') return dayRange(selectedDate)
    if (view === 'week') return weekRange(selectedDate)
    return monthGridRange(selectedDate)
  }, [view, selectedDate])

  const occurrences = useMemo(() => {
    const all = expandOccurrences(events, calendars, exceptions, range.start, range.end)
    if (!pendingTasksOnly) return all
    return all.filter((o) => o.kind === 'task' && o.taskStatus === 'pending')
  }, [events, calendars, exceptions, range, pendingTasksOnly])

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
      kind: 'event',
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
      kind: occ.kind,
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
        pendingTasksOnly={pendingTasksOnly}
        onPendingTasksOnlyChange={setPendingTasksOnly}
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
        events={events}
        taskRuns={taskRuns}
        initial={draft}
        onClose={() => setModalOpen(false)}
        onSave={saveEvent}
        onStartTask={startTask}
        onCompleteTask={completeTask}
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
