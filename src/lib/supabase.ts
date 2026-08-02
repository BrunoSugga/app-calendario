import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function isAllowedSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return false
    // Proyectos Supabase o URL custom HTTPS
    return Boolean(parsed.hostname)
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
