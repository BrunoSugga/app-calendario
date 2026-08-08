import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getPasswordSetupMode } from '../../lib/authLink'
import { assertCloudPassword } from '../../lib/security'

export function SetPasswordPage() {
  const { completePasswordSetup, signOut, user, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mode = getPasswordSetupMode()
  const recovery = mode === 'recovery'

  if (!loading && !user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Enlace incompleto</h1>
          <p className="login-sub">
            Abrí el link del correo de invitación o de restablecimiento en una ventana donde no
            estés logueado como otro usuario. Si expiró, pedí uno nuevo desde “Olvidé mi
            contraseña”.
          </p>
          <button type="button" className="btn primary" onClick={() => void signOut()}>
            Ir al inicio
          </button>
        </div>
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      assertCloudPassword(password)
      if (password !== confirm) {
        throw new Error('Las contraseñas no coinciden')
      }
      await completePasswordSetup(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la contraseña')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <img
          className="login-logo"
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="BMatrix Calendario"
        />
        <h1>{recovery ? 'Restablecé tu contraseña' : 'Activá tu cuenta'}</h1>
        <p className="login-sub">
          {recovery
            ? 'Elegí una contraseña nueva para volver a entrar.'
            : 'Te invitaron a BMatrix Calendario. Esta pantalla es solo para la cuenta del link (no la del administrador). Creá tu propia contraseña.'}
        </p>
        {user?.email && (
          <p className="login-hint">
            Vas a activar: <strong>{user.email}</strong>
            {user.role === 'admin' ? (
              <>
                {' '}
                (ojo: es la cuenta admin; abrí el link del invitado en una ventana de
                incógnito si querías activar otro correo)
              </>
            ) : null}
          </p>
        )}
        <p className="login-hint">Mínimo 8 caracteres, con al menos una letra y un número.</p>

        <label>
          {recovery ? 'Nueva contraseña' : 'Tu contraseña'}
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        <label>
          Confirmar contraseña
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Guardando…' : recovery ? 'Guardar e ingresar' : 'Activar e ingresar'}
        </button>

        <button type="button" className="btn link" onClick={() => void signOut()}>
          Cancelar
        </button>
      </form>
    </div>
  )
}
