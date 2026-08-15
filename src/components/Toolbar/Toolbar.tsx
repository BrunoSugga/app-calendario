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
  onOpenSidebar?: () => void
}

export function Toolbar({
  view,
  selectedDate,
  zoom,
  onViewChange,
  onNavigate,
  onToday,
  onZoom,
  onOpenSidebar,
}: Props) {
  const isOrganizer = view === 'organizer'

  return (
    <header className="toolbar">
      {onOpenSidebar && (
        <button
          type="button"
          className="btn icon toolbar-menu"
          aria-label="Abrir menú"
          onClick={onOpenSidebar}
        >
          ☰
        </button>
      )}
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
        {!isOrganizer && (
          <>
            <button type="button" className="btn icon" onClick={() => onNavigate(-1)}>
              ‹
            </button>
            <button type="button" className="btn icon" onClick={() => onNavigate(1)}>
              ›
            </button>
          </>
        )}
        <h1 className="toolbar-title">
          {isOrganizer ? 'organizador de eventos' : formatDayHeader(selectedDate)}
        </h1>
      </div>

      <div className="toolbar-actions">
        {!isOrganizer && (
          <>
            <button type="button" className="btn icon" title="Alejar" onClick={() => onZoom(-1)}>
              −
            </button>
            <button type="button" className="btn icon" title="Acercar" onClick={() => onZoom(1)}>
              +
            </button>
            <span className="zoom-label">{zoom}%</span>
          </>
        )}
        <button
          type="button"
          className={
            isOrganizer
              ? 'btn toolbar-mode-button organizer-button active'
              : 'btn toolbar-mode-button organizer-button'
          }
          aria-pressed={isOrganizer}
          onClick={() => onViewChange('organizer')}
        >
          Organizador
        </button>
        <button
          type="button"
          className={
            isOrganizer
              ? 'btn toolbar-mode-button today'
              : 'btn toolbar-mode-button today active'
          }
          aria-pressed={!isOrganizer}
          onClick={onToday}
        >
          {new Date().getDate()} Hoy
        </button>
      </div>
    </header>
  )
}
