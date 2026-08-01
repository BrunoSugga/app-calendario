import { addMonths } from 'date-fns'
import {
  buildMonthCells,
  formatMonthTitle,
  isSameDay,
  isSameMonth,
} from '../../domain/dates'

type Props = {
  month: Date
  selected: Date
  onSelect: (date: Date) => void
  onMonthChange?: (month: Date) => void
  showNav?: boolean
}

export function MiniCalendar({
  month,
  selected,
  onSelect,
  onMonthChange,
  showNav = false,
}: Props) {
  const cells = buildMonthCells(month)
  const weekdays = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']

  return (
    <div className="mini-cal">
      <div className="mini-cal-header">
        {showNav && (
          <button
            type="button"
            className="btn icon tiny"
            onClick={() => onMonthChange?.(addMonths(month, -1))}
          >
            ‹
          </button>
        )}
        <span>{formatMonthTitle(month)}</span>
        {showNav && (
          <button
            type="button"
            className="btn icon tiny"
            onClick={() => onMonthChange?.(addMonths(month, 1))}
          >
            ›
          </button>
        )}
      </div>
      <div className="mini-cal-grid">
        {weekdays.map((d) => (
          <div key={d} className="mini-cal-dow">
            {d}
          </div>
        ))}
        {cells.map((day) => {
          const outside = !isSameMonth(day, month)
          const selectedDay = isSameDay(day, selected)
          const today = isSameDay(day, new Date())
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={[
                'mini-cal-day',
                outside ? 'outside' : '',
                selectedDay ? 'selected' : '',
                today ? 'today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelect(day)}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
