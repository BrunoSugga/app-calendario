import { format } from 'date-fns'
import { kindLabel } from '../../domain/eventKind'
import type { MissedReminderRow } from '../../hooks/useReminders'

type Props = {
  items: MissedReminderRow[] | null
  onDismiss: () => void
  onOpen?: (payload: { eventId: string; startsAt: string }) => void
}

export function MissedRemindersModal({ items, onDismiss, onOpen }: Props) {
  if (!items || items.length === 0) return null

  const sorted = [...items].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )

  return (
    <div className="modal-backdrop" role="presentation" onClick={onDismiss}>
      <div
        className="modal missed-reminders-modal"
        role="dialog"
        aria-labelledby="missed-reminders-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="missed-reminders-title">Avisos no vistos</h2>
        </header>
        <p className="missed-reminders-intro">
          Mientras la app estuvo cerrada hubo {sorted.length} aviso
          {sorted.length === 1 ? '' : 's'} de hace más de 15 días. Revisalos y marcá como vistos.
        </p>
        <div className="modal-body missed-reminders-table-wrap">
          <table className="missed-reminders-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Título</th>
                <th scope="col">Calendario</th>
                <th scope="col">Tipo</th>
                <th scope="col"> </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const when = new Date(row.startsAt)
                const timeLabel = Number.isNaN(when.getTime())
                  ? '—'
                  : format(when, 'dd/MM/yyyy HH:mm')
                return (
                  <tr key={row.fireKey}>
                    <td>{timeLabel}</td>
                    <td>{row.title || 'Sin título'}</td>
                    <td>{row.calendarName}</td>
                    <td>{kindLabel(row.kind)}</td>
                    <td>
                      {onOpen ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={() =>
                            onOpen({ eventId: row.eventId, startsAt: row.startsAt })
                          }
                        >
                          Abrir
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onDismiss}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
