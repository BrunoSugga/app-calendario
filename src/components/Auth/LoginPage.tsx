import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'

export function LoginPage() {
  const { signIn, signUp, isCloud } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password || 'local')
      } else {
        await signUp(email.trim(), password || 'local', displayName.trim() || email.split('@')[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo autenticar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Calendario</h1>
        <p className="login-sub">
          {isCloud
            ? 'Iniciá sesión para sincronizar entre dispositivos'
            : 'Modo local (sin Supabase). Los datos quedan en este navegador.'}
        </p>

        {mode === 'register' && (
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
            placeholder="bruno@ejemplo.com"
            autoComplete="email"
          />
        </label>

        {isCloud && (
          <label>
            Contraseña
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Espere…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <button
          type="button"
          className="btn link"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
        </button>
      </form>
    </div>
  )
}
