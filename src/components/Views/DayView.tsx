import { useMemo } from 'react'
import { formatShortWeekday, formatTime, isSameDay } from '../../domain/dates'
import type { Occurrence } from '../../types'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_PX = 48

type Props = {
  date: Date
  occurrences: Occurrence[]
  zoom: number
  onSlotClick: (date: Date) => void
  onOccurrenceClick: (occ: Occurrence) => void
}

export function DayView({ date, occurrences, zoom, onSlotClick, onOccurrenceClick }: Props) {
  const scale = zoom / 100
  const hourHeight = HOUR_PX * scale

  const dayEvents = useMemo(
    () => occurrences.filter((o) => isSameDay(o.startsAt, date)),
    [occurrences, date],
  )

  return (
    <div className="time-grid day-view">
      <div className="time-grid-header">
        <div className="gutter" />
        <div className="day-col-header">
          <span className="day-num">{date.getDate()}</span>
          <span className="day-name">{formatShortWeekday(date)}</span>
        </div>
      </div>
      <div className="time-grid-body">
        <div className="hours-gutter" style={{ height: hourHeight * 24 }}>
          {HOURS.map((h) => (
            <div key={h} className="hour-label" style={{ height: hourHeight }}>
              {h}
            </div>
          ))}
        </div>
        <div
          className="day-column"
          style={{ height: hourHeight * 24 }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const y = e.clientY - rect.top
            const minutes = Math.floor(y / hourHeight) * 60
            const slot = new Date(date)
            slot.setHours(0, 0, 0, 0)
            slot.setMinutes(minutes)
            onSlotClick(slot)
          }}
        >
          {HOURS.map((h) => (
            <div key={h} className="hour-slot" style={{ height: hourHeight }}>
              {h === 10 && dayEvents.length === 0 && (
                <span className="slot-placeholder">Haga clic aquí para agregar un evento</span>
              )}
            </div>
          ))}
          {dayEvents.map((occ) => {
            const startMin = occ.startsAt.getHours() * 60 + occ.startsAt.getMinutes()
            const endMin = occ.endsAt.getHours() * 60 + occ.endsAt.getMinutes()
            const top = (startMin / 60) * hourHeight
            const height = Math.max(((endMin - startMin) / 60) * hourHeight, 22)
            const timeLabel = `${formatTime(occ.startsAt)} - ${formatTime(occ.endsAt)}`
            return (
              <button
                key={`${occ.eventId}-${occ.originalStartsAt.toISOString()}`}
                type="button"
                className={height < 36 ? 'event-block short' : 'event-block'}
                style={{ top, height, background: occ.color }}
                title={`${occ.title} (${timeLabel})`}
                onClick={(e) => {
                  e.stopPropagation()
                  onOccurrenceClick(occ)
                }}
              >
                <strong>{occ.title || 'Sin título'}</strong>
                <span>{timeLabel}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
