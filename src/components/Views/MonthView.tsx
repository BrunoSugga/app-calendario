import { buildMonthCells, isSameDay, isSameMonth } from '../../domain/dates'
import type { Occurrence } from '../../types'

type Props = {
  date: Date
  occurrences: Occurrence[]
  onSelectDate: (date: Date) => void
  onOccurrenceClick: (occ: Occurrence) => void
  onDayDoubleClick: (date: Date) => void
}

export function MonthView({
  date,
  occurrences,
  onSelectDate,
  onOccurrenceClick,
  onDayDoubleClick,
}: Props) {
  const cells = buildMonthCells(date)
  const weekdays = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

  return (
    <div className="month-view">
      <div className="month-weekdays">
        {weekdays.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((day) => {
          const dayOcc = occurrences.filter((o) => isSameDay(o.startsAt, day))
          const outside = !isSameMonth(day, date)
          const selected = isSameDay(day, date)
          return (
            <div
              key={day.toISOString()}
              className={['month-cell', outside ? 'outside' : '', selected ? 'selected' : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDate(day)}
              onDoubleClick={() => onDayDoubleClick(day)}
            >
              <div className="month-cell-num">{day.getDate()}</div>
              <div className="month-cell-events">
                {dayOcc.slice(0, 3).map((occ) => (
                  <button
                    key={`${occ.eventId}-${occ.originalStartsAt.toISOString()}`}
                    type="button"
                    className="month-event"
                    style={{ background: occ.color }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOccurrenceClick(occ)
                    }}
                  >
                    {occ.title}
                  </button>
                ))}
                {dayOcc.length > 3 && (
                  <span className="more-events">+{dayOcc.length - 3} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
