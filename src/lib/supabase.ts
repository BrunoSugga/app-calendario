import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function isAllowedSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return false
    // Sin credenciales embebidas ni hosts vacíos
    if (parsed.username || parsed.password) return false
    if (!parsed.hostname || parsed.hostname.includes('..')) return false
    // Proyectos Supabase o dominio HTTPS propio (sin IP cruda opcional)
    return Boolean(parsed.hostname.includes('.'))
  } catch {
    return false
  }
}

export const isCloudMode = Boolean(isAllowedSupabaseUrl(url) && anonKey && anonKey.length > 20)

export const supabase: SupabaseClient | null = isCloudMode
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null
