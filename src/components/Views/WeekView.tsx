import { useMemo } from 'react'
import { eachDay, formatShortWeekday, formatTime, isSameDay, weekRange } from '../../domain/dates'
import { kindColor, kindGlyph, kindLabel } from '../../domain/eventKind'
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

export function WeekView({ date, occurrences, zoom, onSlotClick, onOccurrenceClick }: Props) {
  const scale = zoom / 100
  const hourHeight = HOUR_PX * scale
  const { start, end } = weekRange(date)
  const days = eachDay(start, end)

  const byDay = useMemo(() => {
    return days.map((day) => occurrences.filter((o) => isSameDay(o.startsAt, day)))
  }, [days, occurrences])

  return (
    <div className="time-grid week-view">
      <div className="time-grid-header week">
        <div className="gutter" />
        {days.map((day) => (
          <div key={day.toISOString()} className="day-col-header">
            <span className="day-num">{day.getDate()}</span>
            <span className="day-name">{formatShortWeekday(day)}</span>
          </div>
        ))}
      </div>
      <div className="time-grid-body week">
        <div className="hours-gutter" style={{ height: hourHeight * 24 }}>
          {HOURS.map((h) => (
            <div key={h} className="hour-label" style={{ height: hourHeight }}>
              {h}
            </div>
          ))}
        </div>
        {days.map((day, idx) => (
          <div
            key={day.toISOString()}
            className="day-column"
            style={{ height: hourHeight * 24 }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const y = e.clientY - rect.top
              const minutes = Math.floor(y / hourHeight) * 60
              const slot = new Date(day)
              slot.setHours(0, 0, 0, 0)
              slot.setMinutes(minutes)
              onSlotClick(slot)
            }}
          >
            {HOURS.map((h) => (
              <div key={h} className="hour-slot" style={{ height: hourHeight }} />
            ))}
            {byDay[idx].map((occ) => {
              const startMin = occ.startsAt.getHours() * 60 + occ.startsAt.getMinutes()
              const endMin = occ.endsAt.getHours() * 60 + occ.endsAt.getMinutes()
              const top = (startMin / 60) * hourHeight
              const height = Math.max(
                ((endMin - startMin) / 60) * hourHeight,
                occ.kind === 'reminder' ? 18 : 20,
              )
              const timeLabel = formatTime(occ.startsAt)
              return (
                <button
                  key={`${occ.eventId}-${occ.originalStartsAt.toISOString()}`}
                  type="button"
                  className={[
                    'event-block',
                    'compact',
                    height < 34 ? 'short' : '',
                    `kind-${occ.kind}`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ top, height, background: kindColor(occ.kind, occ.color) }}
                  title={`${kindLabel(occ.kind)}: ${occ.title}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOccurrenceClick(occ)
                  }}
                >
                  <strong>
                    <span className="kind-glyph" aria-hidden>
                      {kindGlyph(occ.kind)}
                    </span>{' '}
                    {occ.title || 'Sin título'}
                  </strong>
                  <span>{timeLabel}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
