import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { isCloudMode, supabase } from '../lib/supabase'
import {
  getLocalSession,
  loadLocalDb,
  localSignIn,
  localSignOut,
  setLocalSession,
} from '../lib/localStore'

type AuthUser = {
  id: string
  email: string
  displayName: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  isCloud: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapCloudUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    displayName:
      (user.user_metadata?.display_name as string | undefined) ||
      user.email?.split('@')[0] ||
      'Usuario',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function init() {
      if (isCloudMode && supabase) {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setUser(data.session?.user ? mapCloudUser(data.session.user) : null)
        setLoading(false)

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ? mapCloudUser(session.user) : null)
        })
        return () => sub.subscription.unsubscribe()
      }

      const sessionEmail = getLocalSession()
      const db = loadLocalDb()
      if (sessionEmail && db && db.email === sessionEmail) {
        setUser({ id: db.userId, email: db.email, displayName: db.displayName })
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
    if (isCloudMode && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return
    }
    const db = localSignIn(email)
    setLocalSession(email)
    setUser({ id: db.userId, email: db.email, displayName: db.displayName })
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    if (isCloudMode && supabase) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) throw error
      return
    }
    const db = localSignIn(email, displayName)
    setLocalSession(email)
    setUser({ id: db.userId, email: db.email, displayName: db.displayName })
  }, [])

  const signOut = useCallback(async () => {
    if (isCloudMode && supabase) {
      await supabase.auth.signOut()
      setUser(null)
      return
    }
    localSignOut()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      isCloud: isCloudMode,
      signIn,
      signUp,
      signOut,
    }),
    [user, loading, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
