/** Hosts https permitidos en redirects de invite/recovery. Debe coincidir con la Edge Function. */
export const AUTH_REDIRECT_HTTPS_HOSTS = [
  'calendario.bmatrix.org',
  'bmx-calendario.pages.dev',
] as const

export const AUTH_REDIRECT_PUBLIC_ORIGIN = 'https://calendario.bmatrix.org'

/** Puerto de `npm run dev` (Vite). No confundir con `https://localhost` de Capacitor. */
export const AUTH_REDIRECT_DEV_PORT = '5173'

export function hostnameOf(url: URL): string {
  return url.hostname.toLowerCase()
}

export function isAllowedAuthRedirectUrl(parsed: URL): boolean {
  const host = hostnameOf(parsed)
  if (parsed.protocol === 'https:') {
    return (AUTH_REDIRECT_HTTPS_HOSTS as readonly string[]).includes(host)
  }
  if (
    parsed.protocol === 'http:' &&
    (host === 'localhost' || host === '127.0.0.1') &&
    parsed.port === AUTH_REDIRECT_DEV_PORT
  ) {
    return true
  }
  return false
}
