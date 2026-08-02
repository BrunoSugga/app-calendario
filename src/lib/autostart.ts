import { isTauri } from './tauri'

export async function getAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false
  const { isEnabled } = await import('@tauri-apps/plugin-autostart')
  return isEnabled()
}

export async function setAutostartEnabled(enabled: boolean): Promise<void> {
  if (!isTauri()) {
    throw new Error('Iniciar con Windows solo está disponible en la app de escritorio.')
  }
  const { enable, disable } = await import('@tauri-apps/plugin-autostart')
  if (enabled) await enable()
  else await disable()
}
