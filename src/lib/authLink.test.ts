import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPasswordSetupMark,
  consumeInboundAuthLink,
  getPasswordSetupMode,
  hasPasswordSetupMark,
  isSafeAuthRedirect,
  markPasswordSetup,
  PASSWORD_SETUP_FLAG,
} from './authLink'

function mockClient(overrides?: {
  signOut?: ReturnType<typeof vi.fn>
  setSession?: ReturnType<typeof vi.fn>
  exchangeCodeForSession?: ReturnType<typeof vi.fn>
  verifyOtp?: ReturnType<typeof vi.fn>
}) {
  return {
    auth: {
      signOut: overrides?.signOut ?? vi.fn().mockResolvedValue({ error: null }),
      setSession: overrides?.setSession ?? vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession:
        overrides?.exchangeCodeForSession ?? vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: overrides?.verifyOtp ?? vi.fn().mockResolvedValue({ error: null }),
    },
  }
}

describe('authLink security', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('acepta solo la allowlist de Auth (no cualquier https ni Capacitor)', () => {
    expect(isSafeAuthRedirect('https://calendario.bmatrix.org/?set-password=1')).toBe(true)
    expect(isSafeAuthRedirect('https://bmx-calendario.pages.dev/?set-password=1')).toBe(true)
    expect(isSafeAuthRedirect('http://localhost:5173/?set-password=1')).toBe(true)
    expect(isSafeAuthRedirect('http://127.0.0.1:5173/')).toBe(true)
    expect(isSafeAuthRedirect('http://evil.example/')).toBe(false)
    expect(isSafeAuthRedirect('javascript:alert(1)')).toBe(false)
    expect(isSafeAuthRedirect('https://localhost')).toBe(false)
    expect(isSafeAuthRedirect('https://localhost/')).toBe(false)
    expect(isSafeAuthRedirect('https://127.0.0.1/')).toBe(false)
    expect(isSafeAuthRedirect('capacitor://localhost')).toBe(false)
    expect(isSafeAuthRedirect('ionic://localhost')).toBe(false)
    expect(isSafeAuthRedirect('http://tauri.localhost/?set-password=1')).toBe(false)
    expect(isSafeAuthRedirect('https://evil.example/')).toBe(false)
    expect(isSafeAuthRedirect('http://localhost/')).toBe(false)
    expect(isSafeAuthRedirect('http://localhost:80/')).toBe(false)
  })

  it('resuelve redirect de auth evitando origen Tauri', async () => {
    const { authAppBaseUrl, authPasswordSetupRedirect } = await import('./authLink')
    const original = window.location
    // vitest/jsdom: simular webview Tauri
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...original,
        origin: 'http://tauri.localhost',
        hostname: 'tauri.localhost',
        protocol: 'http:',
        href: 'http://tauri.localhost/',
      },
    })
    expect(isSafeAuthRedirect('http://tauri.localhost/?set-password=1')).toBe(false)
    expect(authAppBaseUrl()).toBe('https://calendario.bmatrix.org/')
    expect(authPasswordSetupRedirect()).toBe('https://calendario.bmatrix.org/?set-password=1')
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  })

  it('resuelve redirect de auth evitando origen Capacitor https://localhost', async () => {
    const { authAppBaseUrl, authPasswordSetupRedirect } = await import('./authLink')
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...original,
        origin: 'https://localhost',
        hostname: 'localhost',
        protocol: 'https:',
        href: 'https://localhost/',
      },
    })
    expect(isSafeAuthRedirect('https://localhost/?set-password=1')).toBe(false)
    expect(authAppBaseUrl()).toBe('https://calendario.bmatrix.org/')
    expect(authPasswordSetupRedirect()).toBe('https://calendario.bmatrix.org/?set-password=1')
    expect(authPasswordSetupRedirect()).not.toMatch(/localhost(?!:5173)/)
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  })

  it('ignora VITE_PUBLIC_APP_URL fuera de la allowlist', async () => {
    const { authAppBaseUrl } = await import('./authLink')
    expect(authAppBaseUrl('https://localhost')).toBe('https://calendario.bmatrix.org/')
    expect(authAppBaseUrl('https://phish.tld')).toBe('https://calendario.bmatrix.org/')
    expect(authAppBaseUrl('https://calendario.bmatrix.org')).toBe('https://calendario.bmatrix.org/')
  })

  it('ignora ?set-password=1 sin marca y avisa enlace incompleto', async () => {
    const client = mockClient()
    const result = await consumeInboundAuthLink(client as never, {
      hash: '',
      search: '?set-password=1',
    })
    expect(result.needsPasswordSetup).toBe(false)
    expect(result.linkError).toMatch(/no trajo una sesión válida/i)
    expect(client.auth.signOut).not.toHaveBeenCalled()
    expect(client.auth.setSession).not.toHaveBeenCalled()
  })

  it('respeta ?set-password=1 si el tab marcó el flujo de invite', async () => {
    markPasswordSetup('invite')
    const client = mockClient()
    const result = await consumeInboundAuthLink(client as never, {
      hash: '',
      search: '?set-password=1',
    })
    expect(result.needsPasswordSetup).toBe(true)
    expect(result.linkError).toBeNull()
    expect(client.auth.signOut).not.toHaveBeenCalled()
  })

  it('limpia sesión local y aplica tokens de invite del hash', async () => {
    const client = mockClient()
    const result = await consumeInboundAuthLink(client as never, {
      hash: '#access_token=aaa&refresh_token=bbb&type=invite',
      search: '?set-password=1',
    })
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(client.auth.setSession).toHaveBeenCalledWith({
      access_token: 'aaa',
      refresh_token: 'bbb',
    })
    expect(result.needsPasswordSetup).toBe(true)
    expect(hasPasswordSetupMark()).toBe(true)
    expect(getPasswordSetupMode()).toBe('invite')
    expect(sessionStorage.getItem(PASSWORD_SETUP_FLAG)).toBe('1')
  })

  it('consume token_hash de invite vía verifyOtp', async () => {
    const client = mockClient()
    const result = await consumeInboundAuthLink(client as never, {
      hash: '',
      search: '?token_hash=xyz&type=invite&set-password=1',
    })
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'xyz',
      type: 'invite',
    })
    expect(result.needsPasswordSetup).toBe(true)
    expect(getPasswordSetupMode()).toBe('invite')
  })

  it('aplica recovery vía PKCE code', async () => {
    const client = mockClient()
    const result = await consumeInboundAuthLink(client as never, {
      hash: '',
      search: '?code=abc&set-password=1',
    })
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(result.needsPasswordSetup).toBe(true)
    expect(getPasswordSetupMode()).toBe('recovery')
  })

  it('expone errores de Supabase en la URL', async () => {
    const client = mockClient()
    const result = await consumeInboundAuthLink(client as never, {
      hash: '',
      search: '?error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
    })
    expect(result.needsPasswordSetup).toBe(false)
    expect(result.linkError).toMatch(/invalid or has expired/i)
  })

  it('propaga error de setSession y no marca setup', async () => {
    const client = mockClient({
      setSession: vi.fn().mockResolvedValue({ error: new Error('token inválido') }),
    })
    await expect(
      consumeInboundAuthLink(client as never, {
        hash: '#access_token=aaa&refresh_token=bbb&type=invite',
        search: '',
      }),
    ).rejects.toThrow(/token inválido/)
    expect(hasPasswordSetupMark()).toBe(false)
  })

  it('clearPasswordSetupMark limpia sessionStorage', () => {
    markPasswordSetup('recovery')
    clearPasswordSetupMark()
    expect(hasPasswordSetupMark()).toBe(false)
    expect(getPasswordSetupMode()).toBeNull()
  })
})
