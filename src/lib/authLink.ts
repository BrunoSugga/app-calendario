import type { SupabaseClient } from '@supabase/supabase-js'

export const PASSWORD_SETUP_FLAG = 'calendario.passwordSetup'
export const PASSWORD_SETUP_MODE = 'calendario.passwordSetupMode'

export type PasswordSetupMode = 'invite' | 'recovery' | 'signup'

export function getHashParams(hash = window.location.hash): URLSearchParams {
  return new URLSearchParams(hash.replace(/^#/, ''))
}

export function isPasswordSetupType(type: string | null | undefined): type is PasswordSetupMode {
  return type === 'invite' || type === 'recovery' || type === 'signup'
}

export function markPasswordSetup(mode: PasswordSetupMode): void {
  try {
    sessionStorage.setItem(PASSWORD_SETUP_FLAG, '1')
    sessionStorage.setItem(PASSWORD_SETUP_MODE, mode)
  } catch {
    // private mode / blocked storage
  }
}

export function clearPasswordSetupMark(): void {
  try {
    sessionStorage.removeItem(PASSWORD_SETUP_FLAG)
    sessionStorage.removeItem(PASSWORD_SETUP_MODE)
  } catch {
    // ignore
  }
}

export function hasPasswordSetupMark(): boolean {
  try {
    return sessionStorage.getItem(PASSWORD_SETUP_FLAG) === '1'
  } catch {
    return false
  }
}

export function getPasswordSetupMode(): PasswordSetupMode | null {
  try {
    const mode = sessionStorage.getItem(PASSWORD_SETUP_MODE)
    return isPasswordSetupType(mode) ? mode : null
  } catch {
    return null
  }
}

export function isSafeAuthRedirect(value: string): boolean {
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'https:') return true
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

function stripAuthArtifacts(forceSetup: boolean) {
  const url = new URL(window.location.href)
  url.hash = ''
  url.searchParams.delete('code')
  if (forceSetup) url.searchParams.set('set-password', '1')
  else url.searchParams.delete('set-password')
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
}

/**
 * Consume invite/recovery del hash/?code.
 * Limpia la sesión local previa (p. ej. admin) antes de aplicar el token del mail.
 */
export async function consumeInboundAuthLink(
  client: SupabaseClient,
  location: { hash: string; search: string } = window.location,
): Promise<{ needsPasswordSetup: boolean }> {
  const hashParams = getHashParams(location.hash)
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  const type = hashParams.get('type')
  const query = new URLSearchParams(location.search)
  const code = query.get('code')
  const flaggedSetup = query.get('set-password') === '1'
  const hasTokens = Boolean(accessToken && refreshToken)
  const hasCode = Boolean(code)

  if (!hasTokens && !hasCode) {
    // ?set-password=1 solo vale si este tab marcó el flujo al consumir el link
    if (flaggedSetup && hasPasswordSetupMark()) {
      return { needsPasswordSetup: true }
    }
    if (flaggedSetup) {
      stripAuthArtifacts(false)
    }
    return { needsPasswordSetup: false }
  }

  // Crítico: no reutilizar la sesión del admin abierta en este navegador
  await client.auth.signOut({ scope: 'local' })

  if (hasTokens && accessToken && refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw error
    const mode: PasswordSetupMode = isPasswordSetupType(type) ? type : 'invite'
    const needsPasswordSetup = flaggedSetup || isPasswordSetupType(type)
    if (needsPasswordSetup) markPasswordSetup(mode)
    stripAuthArtifacts(needsPasswordSetup)
    return { needsPasswordSetup }
  }

  if (hasCode && code) {
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (error) throw error
    const mode: PasswordSetupMode = isPasswordSetupType(type) ? type : 'recovery'
    const needsPasswordSetup = flaggedSetup || isPasswordSetupType(type)
    if (needsPasswordSetup) markPasswordSetup(mode)
    stripAuthArtifacts(needsPasswordSetup)
    return { needsPasswordSetup }
  }

  return { needsPasswordSetup: false }
}
