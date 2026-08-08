import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isCloudMode, supabase } from '../lib/supabase'
import {
  getLocalSession,
  loadLocalDb,
  localSignIn,
  localSignOut,
  setLocalSession,
} from '../lib/localStore'
import { assertCloudPassword, clampText, isValidEmail } from '../lib/security'

export type UserRole = 'admin' | 'member'

type AuthUser = {
  id: string
  email: string
  displayName: string
  role: UserRole
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  isCloud: boolean
  isAdmin: boolean
  needsPasswordSetup: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Solo modo local. En cloud las altas son por invitación de admin. */
  signUpLocal: (email: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  completePasswordSetup: (password: string) => Promise<void>
  clearPasswordSetup: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapDisplayName(user: User, fallback?: string | null): string {
  return (
    (user.user_metadata?.display_name as string | undefined) ||
    fallback ||
    user.email?.split('@')[0] ||
    'Usuario'
  )
}

function normalizeEmail(email: string): string {
  const next = email.trim().toLowerCase()
  if (!isValidEmail(next)) throw new Error('Correo inválido')
  return next
}

function getHashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''))
}

function isPasswordSetupType(type: string | null): boolean {
  return type === 'invite' || type === 'recovery' || type === 'signup'
}

function stripAuthHashKeepSetupFlag(forceSetup: boolean) {
  const url = new URL(window.location.href)
  url.hash = ''
  if (forceSetup) url.searchParams.set('set-password', '1')
  else url.searchParams.delete('set-password')
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
}

/**
 * Si el link trae tokens de invite/recovery, limpia la sesión local (p. ej. admin)
 * y aplica la sesión del link. Evita cambiar la contraseña del usuario equivocado.
 */
async function consumeInboundAuthLink(
  client: SupabaseClient,
): Promise<{ needsPasswordSetup: boolean }> {
  const hashParams = getHashParams()
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  const type = hashParams.get('type')
  const query = new URLSearchParams(window.location.search)
  const code = query.get('code')
  const flaggedSetup = query.get('set-password') === '1'
  const inbound =
    Boolean(accessToken && refreshToken) ||
    Boolean(code) ||
    isPasswordSetupType(type)

  if (!inbound) {
    return { needsPasswordSetup: flaggedSetup }
  }

  // Crítico: no reutilizar la sesión del admin abierta en este navegador
  await client.auth.signOut({ scope: 'local' })

  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw error
    const needsPasswordSetup = flaggedSetup || isPasswordSetupType(type)
    stripAuthHashKeepSetupFlag(needsPasswordSetup)
    return { needsPasswordSetup }
  }

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (error) throw error
    const needsPasswordSetup = flaggedSetup || isPasswordSetupType(type)
    const url = new URL(window.location.href)
    url.searchParams.delete('code')
    if (needsPasswordSetup) url.searchParams.set('set-password', '1')
    url.hash = ''
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    return { needsPasswordSetup }
  }

  return { needsPasswordSetup: flaggedSetup || isPasswordSetupType(type) }
}

async function mapCloudUser(user: User): Promise<AuthUser> {
  let displayName = mapDisplayName(user)
  let role: UserRole = 'member'
  if (supabase) {
    const { data } = await supabase
      .from('profiles')
      .select('role, display_name')
      .eq('id', user.id)
      .maybeSingle()
    if (data?.display_name) displayName = String(data.display_name)
    if (data?.role === 'admin') role = 'admin'
  }
  return {
    id: user.id,
    email: user.email ?? '',
    displayName,
    role,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false)

  useEffect(() => {
    let mounted = true

    async function init() {
      if (isCloudMode && supabase) {
        let setup = false
        try {
          const inbound = await consumeInboundAuthLink(supabase)
          setup = inbound.needsPasswordSetup
        } catch {
          setup = new URLSearchParams(window.location.search).get('set-password') === '1'
        }
        if (!mounted) return
        setNeedsPasswordSetup(setup)

        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setUser(data.session?.user ? await mapCloudUser(data.session.user) : null)
        setLoading(false)

        const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return
          if (event === 'PASSWORD_RECOVERY') {
            setNeedsPasswordSetup(true)
          }
          if (event === 'SIGNED_OUT') {
            setNeedsPasswordSetup(false)
            setUser(null)
            return
          }
          setUser(session?.user ? await mapCloudUser(session.user) : null)
        })
        return () => sub.subscription.unsubscribe()
      }

      const sessionEmail = getLocalSession()
      const db = loadLocalDb()
      if (sessionEmail && db && db.email === sessionEmail) {
        setUser({
          id: db.userId,
          email: db.email,
          displayName: db.displayName,
          role: 'member',
        })
      }
      setLoading(false)
      return undefined
    }

    const cleanupPromise = init()
    return () => {
      mounted = false
      void cleanupPromise.then((cleanup) => cleanup?.())
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const normalized = normalizeEmail(email)
    if (isCloudMode && supabase) {
      if (!password || password.length > 128) {
        throw new Error('Contraseña inválida')
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      })
      if (error) throw error
      return
    }
    const db = localSignIn(normalized)
    setLocalSession(normalized)
    setUser({
      id: db.userId,
      email: db.email,
      displayName: db.displayName,
      role: 'member',
    })
  }, [])

  const signUpLocal = useCallback(async (email: string, displayName: string) => {
    if (isCloudMode) {
      throw new Error('En modo nube las cuentas se crean solo por invitación del administrador')
    }
    const normalized = normalizeEmail(email)
    const name = clampText(displayName || normalized.split('@')[0] || 'Usuario', 120)
    const db = localSignIn(normalized, name)
    setLocalSession(normalized)
    setUser({
      id: db.userId,
      email: db.email,
      displayName: db.displayName,
      role: 'member',
    })
  }, [])

  const signOut = useCallback(async () => {
    if (isCloudMode && supabase) {
      await supabase.auth.signOut()
      setNeedsPasswordSetup(false)
      setUser(null)
      return
    }
    localSignOut()
    setUser(null)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!isCloudMode || !supabase) {
      throw new Error('El restablecimiento de contraseña solo aplica en modo nube')
    }
    const normalized = normalizeEmail(email)
    const baseUrl = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/?$/, '/')
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: `${baseUrl}?set-password=1`,
    })
    if (error) throw error
  }, [])

  const completePasswordSetup = useCallback(async (password: string) => {
    if (!isCloudMode || !supabase) {
      throw new Error('No hay sesión de nube')
    }
    assertCloudPassword(password)
    const {
      data: { user: current },
    } = await supabase.auth.getUser()
    if (!current) {
      throw new Error('Abrí el link del correo de invitación en una ventana sin otra sesión')
    }
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setNeedsPasswordSetup(false)
    if (data.user) setUser(await mapCloudUser(data.user))
    const url = new URL(window.location.href)
    url.searchParams.delete('set-password')
    url.hash = ''
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  }, [])

  const clearPasswordSetup = useCallback(() => {
    setNeedsPasswordSetup(false)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      isCloud: isCloudMode,
      isAdmin: user?.role === 'admin',
      needsPasswordSetup,
      signIn,
      signUpLocal,
      signOut,
      requestPasswordReset,
      completePasswordSetup,
      clearPasswordSetup,
    }),
    [
      user,
      loading,
      needsPasswordSetup,
      signIn,
      signUpLocal,
      signOut,
      requestPasswordReset,
      completePasswordSetup,
      clearPasswordSetup,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
