import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useCalendarData } from '../../context/CalendarDataContext'
import {
  assertBackupFileWithinLimit,
  buildCalendarBackup,
  downloadCalendarBackup,
  MAX_BACKUP_FILE_BYTES,
  parseCalendarBackup,
} from '../../lib/calendarBackup'
import { useAuth } from '../../context/AuthContext'

type Props = {
  open: boolean
  onClose: () => void
}

type DeleteStep = {
  calendarId: string
  backupDownloaded: boolean
  moveToCalendarId: string
  deleteEvents: boolean
}

const COLORS = ['#3D9BE0', '#E07A3D', '#3DBE7A', '#C03DE0', '#E0C03D', '#E03D5C']

export function ManageCalendarsModal({ open, onClose }: Props) {
  const { user } = useAuth()
  const {
    calendars,
    events,
    exceptions,
    taskRuns,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    importCalendarBackup,
  } = useCalendarData()

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [edits, setEdits] = useState<Record<string, { name: string; color: string }>>({})
  const [deleteStep, setDeleteStep] = useState<DeleteStep | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setEdits((prev) => {
      const next: Record<string, { name: string; color: string }> = {}
      for (const c of calendars) {
        next[c.id] = prev[c.id] ?? { name: c.name, color: c.color }
      }
      return next
    })
  }, [open, calendars])

  useEffect(() => {
    if (!open) return
    setNewName('')
    setNewColor(COLORS[0])
    setDeleteStep(null)
    setError(null)
    setMsg(null)
  }, [open])

  const eventCountByCal = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of events) {
      map.set(e.calendar_id, (map.get(e.calendar_id) ?? 0) + 1)
    }
    return map
  }, [events])

  if (!open) return null

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createCalendar(newName.trim(), newColor)
      setNewName('')
      setMsg('Calendario creado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveRow(id: string) {
    const edit = edits[id]
    if (!edit) return
    setBusy(true)
    setError(null)
    try {
      await updateCalendar(id, { name: edit.name, color: edit.color })
      setMsg('Calendario actualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  function startDelete(calendarId: string) {
    if (calendars.length <= 1) {
      setError('No se puede eliminar el único calendario.')
      return
    }
    const other = calendars.find((c) => c.id !== calendarId)
    setDeleteStep({
      calendarId,
      backupDownloaded: false,
      moveToCalendarId: other?.id ?? '',
      deleteEvents: false,
    })
    setError(null)
    setMsg(null)
  }

  function downloadBackupFor(calendarId: string) {
    try {
      const backup = buildCalendarBackup(
        { calendars, events, exceptions, taskRuns },
        calendarId,
      )
      downloadCalendarBackup(backup)
      setDeleteStep((prev) =>
        prev && prev.calendarId === calendarId ? { ...prev, backupDownloaded: true } : prev,
      )
      setMsg('Respaldo descargado. Guardalo en un lugar seguro.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el respaldo')
    }
  }

  async function confirmDelete() {
    if (!deleteStep) return
    if (!deleteStep.backupDownloaded) {
      setError('Descargá el respaldo antes de eliminar.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteCalendar(
        deleteStep.calendarId,
        deleteStep.deleteEvents
          ? undefined
          : { moveToCalendarId: deleteStep.moveToCalendarId },
      )
      setDeleteStep(null)
      setMsg('Calendario eliminado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setBusy(false)
    }
  }

  async function onRestoreFile(file: File) {
    if (!user) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      assertBackupFileWithinLimit(file)
      const text = await file.text()
      if (text.length > MAX_BACKUP_FILE_BYTES) {
        throw new Error('El contenido del respaldo supera el tamaño máximo permitido')
      }
      const raw = JSON.parse(text) as unknown
      const backup = parseCalendarBackup(raw, user.id)
      await importCalendarBackup(backup)
      setMsg(`Respaldo restaurado: “${backup.calendar.name}”.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restaurar el respaldo')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const deleting = deleteStep
    ? calendars.find((c) => c.id === deleteStep.calendarId)
    : null
  const deleteEventCount = deleteStep
    ? (eventCountByCal.get(deleteStep.calendarId) ?? 0)
    : 0

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal manage-calendars-modal"
        role="dialog"
        aria-labelledby="manage-cals-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="manage-cals-title">Gestionar calendarios</h2>
        <p className="login-sub">
          Creá, renombrá o eliminá calendarios. Al eliminar se descarga un respaldo recuperable.
        </p>

        <ul className="manage-cal-list">
          {calendars.map((cal) => {
            const edit = edits[cal.id] ?? { name: cal.name, color: cal.color }
            const count = eventCountByCal.get(cal.id) ?? 0
            return (
              <li key={cal.id} className="manage-cal-row">
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(edit.color) ? edit.color.toLowerCase() : '#3d9be0'}
                  aria-label={`Color de ${cal.name}`}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [cal.id]: { ...edit, color: e.target.value.toUpperCase() },
                    }))
                  }
                />
                <input
                  className="manage-cal-name"
                  value={edit.name}
                  aria-label={`Nombre de ${cal.name}`}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [cal.id]: { ...edit, name: e.target.value },
                    }))
                  }
                />
                <span className="muted tiny">{count} ev.</span>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void onSaveRow(cal.id)}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy || calendars.length <= 1}
                  title={calendars.length <= 1 ? 'No se puede eliminar el único calendario' : 'Eliminar'}
                  onClick={() => startDelete(cal.id)}
                >
                  Eliminar
                </button>
              </li>
            )
          })}
        </ul>

        {deleteStep && deleting && (
          <div className="manage-cal-delete">
            <h3>Eliminar “{deleting.name}”</h3>
            <p>
              Este calendario tiene <strong>{deleteEventCount}</strong> evento
              {deleteEventCount === 1 ? '' : 's'}.
            </p>
            <ol className="manage-cal-delete-steps">
              <li>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => downloadBackupFor(deleteStep.calendarId)}
                >
                  {deleteStep.backupDownloaded ? 'Volver a descargar respaldo' : '1. Descargar respaldo'}
                </button>
                {deleteStep.backupDownloaded && (
                  <span className="ok-hint"> Respaldo listo</span>
                )}
              </li>
              <li>
                <label className="checkbox">
                  <input
                    type="radio"
                    name="delete-mode"
                    checked={!deleteStep.deleteEvents}
                    onChange={() =>
                      setDeleteStep((prev) => (prev ? { ...prev, deleteEvents: false } : prev))
                    }
                  />
                  Mover eventos a
                </label>
                <select
                  disabled={deleteStep.deleteEvents || busy}
                  value={deleteStep.moveToCalendarId}
                  onChange={(e) =>
                    setDeleteStep((prev) =>
                      prev ? { ...prev, moveToCalendarId: e.target.value } : prev,
                    )
                  }
                >
                  {calendars
                    .filter((c) => c.id !== deleteStep.calendarId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </li>
              <li>
                <label className="checkbox">
                  <input
                    type="radio"
                    name="delete-mode"
                    checked={deleteStep.deleteEvents}
                    onChange={() =>
                      setDeleteStep((prev) => (prev ? { ...prev, deleteEvents: true } : prev))
                    }
                  />
                  Eliminar también los eventos (quedan en el respaldo)
                </label>
              </li>
            </ol>
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setDeleteStep(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={busy || !deleteStep.backupDownloaded}
                onClick={() => void confirmDelete()}
              >
                Confirmar eliminación
              </button>
            </div>
          </div>
        )}

        <form className="manage-cal-create" onSubmit={(e) => void onCreate(e)}>
          <h3>Nuevo calendario</h3>
          <div className="manage-cal-create-row">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value.toUpperCase())}
              aria-label="Color del nuevo calendario"
            />
            <input
              placeholder="Nombre"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={120}
            />
            <button type="submit" className="btn primary" disabled={busy || !newName.trim()}>
              Crear
            </button>
          </div>
        </form>

        <div className="manage-cal-restore">
          <h3>Restaurar respaldo</h3>
          <p className="hint tiny">
            Importá un JSON descargado al eliminar. Se crea un calendario nuevo (no pisa los
            existentes).
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onRestoreFile(file)
            }}
          />
        </div>

        {msg && <p className="muted tiny">{msg}</p>}
        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
