import { formatDayHeader } from '../../domain/dates'
import type { ViewMode } from '../../types'

type Props = {
  view: ViewMode
  selectedDate: Date
  zoom: number
  onViewChange: (view: ViewMode) => void
  onNavigate: (delta: number) => void
  onToday: () => void
  onZoom: (delta: number) => void
}

export function Toolbar({
  view,
  selectedDate,
  zoom,
  onViewChange,
  onNavigate,
  onToday,
  onZoom,
}: Props) {
  return (
    <header className="toolbar">
      <div className="view-tabs">
        {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={view === mode ? 'tab active' : 'tab'}
            onClick={() => onViewChange(mode)}
          >
            {mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </div>

      <div className="toolbar-nav">
        <button type="button" className="btn icon" onClick={() => onNavigate(-1)}>
          ‹
        </button>
        <button type="button" className="btn icon" onClick={() => onNavigate(1)}>
          ›
        </button>
        <h1 className="toolbar-title">{formatDayHeader(selectedDate)}</h1>
      </div>

      <div className="toolbar-actions">
        <button type="button" className="btn icon" title="Alejar" onClick={() => onZoom(-1)}>
          −
        </button>
        <button type="button" className="btn icon" title="Acercar" onClick={() => onZoom(1)}>
          +
        </button>
        <span className="zoom-label">{zoom}%</span>
        <button type="button" className="btn today" onClick={onToday}>
          {new Date().getDate()} Hoy
        </button>
      </div>
    </header>
  )
}
