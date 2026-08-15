/** Escritorio Tauri (inyecta `__TAURI_INTERNALS__`). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * App nativa Capacitor (Android / iOS).
 * No importar `@capacitor/core` acá: el runtime inyecta `window.Capacitor`.
 */
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor
    return Boolean(cap?.isNativePlatform?.())
  } catch {
    return false
  }
}

export function isNativeShell(): boolean {
  return isTauri() || isCapacitor()
}
