import { useState, type FormEvent } from 'react'
import { inviteTeamUser } from '../../lib/invite'

type Props = {
  open: boolean
  onClose: () => void
}

export function InviteUserModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await inviteTeamUser(email)
      setInfo(`Invitación enviada a ${email.trim().toLowerCase()}`)
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo invitar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="modal invite-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <h2>Invitar usuario</h2>
        <p className="login-sub">
          Podés invitar Gmail, Camposur u otro correo. La persona recibirá un mail para crear su
          contraseña.
        </p>
        <label>
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="compañero@gmail.com"
            autoComplete="email"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        {info && <p className="form-info">{info}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </div>
      </form>
    </div>
  )
}
