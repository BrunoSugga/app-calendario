import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js'

export const PASSWORD_SETUP_FLAG = 'calendario.passwordSetup'
export const PASSWORD_SETUP_MODE = 'calendario.passwordSetupMode'

export type PasswordSetupMode = 'invite' | 'recovery' | 'signup'

export type ConsumeAuthLinkResult = {
  needsPasswordSetup: boolean
  /** Si el link llegó roto/expirado, mensaje para mostrar en login */
  linkError: string | null
}

export function getHashParams(hash = window.location.hash): URLSearchParams {
  return new URLSearchParams(hash.replace(/^#/, ''))
}

export function isPasswordSetupType(type: string | null | undefined): type is PasswordSetupMode {
  return type === 'invite' || type === 'recovery' || type === 'signup'
}

function toOtpType(type: string | null): EmailOtpType | null {
  if (
    type === 'invite' ||
    type === 'recovery' ||
    type === 'signup' ||
    type === 'email' ||
    type === 'magiclink' ||
    type === 'email_change'
  ) {
    return type
  }
  return null
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

function readAuthError(query: URLSearchParams, hashParams: URLSearchParams): string | null {
  const description =
    query.get('error_description') ||
    hashParams.get('error_description') ||
    query.get('error') ||
    hashParams.get('error')
  if (!description) return null
  return decodeURIComponent(description.replace(/\+/g, ' '))
}

function stripAuthArtifacts(forceSetup: boolean) {
  const url = new URL(window.location.href)
  url.hash = ''
  url.searchParams.delete('code')
  url.searchParams.delete('token_hash')
  url.searchParams.delete('type')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  url.searchParams.delete('error_code')
  if (forceSetup) url.searchParams.set('set-password', '1')
  else url.searchParams.delete('set-password')
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
}

function setupModeFromType(type: string | null, fallback: PasswordSetupMode): PasswordSetupMode {
  return isPasswordSetupType(type) ? type : fallback
}

/**
 * Consume invite/recovery del hash, ?code o ?token_hash.
 * Limpia la sesión local previa (p. ej. admin) antes de aplicar el token del mail.
 */
export async function consumeInboundAuthLink(
  client: SupabaseClient,
  location: { hash: string; search: string } = window.location,
): Promise<ConsumeAuthLinkResult> {
  const hashParams = getHashParams(location.hash)
  const query = new URLSearchParams(location.search)
  const authError = readAuthError(query, hashParams)
  if (authError) {
    stripAuthArtifacts(false)
    return {
      needsPasswordSetup: false,
      linkError: `El enlace de invitación/recuperación falló: ${authError}`,
    }
  }

  const accessToken = hashParams.get('access_token') || query.get('access_token')
  const refreshToken = hashParams.get('refresh_token') || query.get('refresh_token')
  const type = hashParams.get('type') || query.get('type')
  const code = query.get('code') || hashParams.get('code')
  const tokenHash = query.get('token_hash') || hashParams.get('token_hash')
  const flaggedSetup = query.get('set-password') === '1'
  const hasTokens = Boolean(accessToken && refreshToken)
  const hasCode = Boolean(code)
  const otpType = toOtpType(type)
  const hasTokenHash = Boolean(tokenHash && otpType)
  const inbound = hasTokens || hasCode || hasTokenHash

  if (!inbound) {
    if (flaggedSetup && hasPasswordSetupMark()) {
      return { needsPasswordSetup: true, linkError: null }
    }
    if (flaggedSetup) {
      stripAuthArtifacts(false)
      return {
        needsPasswordSetup: false,
        linkError:
          'El enlace no trajo una sesión válida (a veces el antivirus del mail lo “gasta”). Pedí otra invitación o usá “Olvidé mi contraseña”.',
      }
    }
    return { needsPasswordSetup: false, linkError: null }
  }

  // Crítico: no reutilizar la sesión del admin abierta en este navegador
  await client.auth.signOut({ scope: 'local' })

  if (hasTokenHash && tokenHash && otpType) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
    if (error) throw error
    const mode = setupModeFromType(type, otpType === 'recovery' ? 'recovery' : 'invite')
    const needsPasswordSetup =
      flaggedSetup ||
      isPasswordSetupType(type) ||
      otpType === 'invite' ||
      otpType === 'recovery' ||
      otpType === 'signup'
    if (needsPasswordSetup) markPasswordSetup(mode)
    stripAuthArtifacts(needsPasswordSetup)
    return { needsPasswordSetup, linkError: null }
  }

  if (hasTokens && accessToken && refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw error
    const mode = setupModeFromType(type, 'invite')
    // Links de mail con tokens siempre van a set-password
    markPasswordSetup(mode)
    stripAuthArtifacts(true)
    return { needsPasswordSetup: true, linkError: null }
  }

  if (hasCode && code) {
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (error) throw error
    const mode = setupModeFromType(type, 'recovery')
    markPasswordSetup(mode)
    stripAuthArtifacts(true)
    return { needsPasswordSetup: true, linkError: null }
  }

  return { needsPasswordSetup: false, linkError: null }
}
