import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'

export function LoginPage() {
  const { signIn, signUpLocal, requestPasswordReset, isCloud, authLinkError, clearAuthLinkError } =
    useAuth()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    clearAuthLinkError()
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email.trim())
        setInfo('Si el correo existe, te enviamos un enlace para crear una nueva contraseña.')
        return
      }
      if (mode === 'login') {
        await signIn(email.trim(), isCloud ? password : 'local')
        return
      }
      // Registro solo en modo local
      await signUpLocal(email.trim(), displayName.trim() || email.split('@')[0] || 'Usuario')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo autenticar')
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
        <h1>BMatrix Calendario</h1>
        <p className="login-sub">
          {mode === 'forgot'
            ? 'Te enviamos un enlace para restablecer la contraseña'
            : isCloud
              ? 'Iniciá sesión con la cuenta que te invitaron'
              : 'Modo local (sin Supabase). Los datos quedan en este navegador.'}
        </p>

        {mode === 'register' && !isCloud && (
          <label>
            Nombre
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Bruno"
              autoComplete="name"
            />
          </label>
        )}

        <label>
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isCloud ? 'tu@correo.com' : 'bruno@ejemplo.com'}
            autoComplete="email"
          />
        </label>

        {isCloud && mode === 'login' && (
          <label>
            Contraseña
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        )}

        {authLinkError && <p className="form-error">{authLinkError}</p>}
        {error && <p className="form-error">{error}</p>}
        {info && <p className="form-info">{info}</p>}

        <button type="submit" className="btn primary" disabled={busy}>
          {busy
            ? 'Espere…'
            : mode === 'forgot'
              ? 'Enviar enlace'
              : mode === 'login'
                ? 'Entrar'
                : 'Crear cuenta local'}
        </button>

        {isCloud && mode === 'login' && (
          <button type="button" className="btn link" onClick={() => setMode('forgot')}>
            Olvidé mi contraseña
          </button>
        )}

        {isCloud && mode === 'forgot' && (
          <button type="button" className="btn link" onClick={() => setMode('login')}>
            Volver al inicio de sesión
          </button>
        )}

        {!isCloud && (
          <button
            type="button"
            className="btn link"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
          </button>
        )}

        {isCloud && mode === 'login' && (
          <p className="login-hint">Las cuentas nuevas las crea el administrador por invitación.</p>
        )}
      </form>
    </div>
  )
}
