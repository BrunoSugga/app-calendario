import { useEffect } from 'react'
import { isTauri } from '../lib/tauri'

export const APP_UPDATE_INITIAL_DELAY_MS = 2_500
export const APP_UPDATE_INTERVAL_MS = 30 * 60 * 1000
export const APP_UPDATE_ACTIVATION_COOLDOWN_MS = 5 * 60 * 1000

type UpdateCandidate = {
  version: string
  downloadAndInstall: () => Promise<void>
}

export type AppUpdaterActions = {
  check: () => Promise<UpdateCandidate | null>
  ask: (version: string) => Promise<boolean>
  relaunch: () => Promise<void>
  warn?: (error: unknown) => void
}

const promptedUpdateVersions = new Set<string>()

export function startAppUpdaterChecks(actions: AppUpdaterActions): () => void {
  let cancelled = false
  let inFlight = false
  let lastCheckStartedAt: number | null = null
  const warn =
    actions.warn ?? ((error: unknown) => console.warn('No se pudo verificar actualizaciones', error))

  const isVisible = () => document.visibilityState !== 'hidden'

  const check = async () => {
    const now = Date.now()
    if (
      cancelled ||
      inFlight ||
      !isVisible() ||
      (lastCheckStartedAt !== null &&
        now - lastCheckStartedAt < APP_UPDATE_ACTIVATION_COOLDOWN_MS)
    ) {
      return
    }

    lastCheckStartedAt = now
    inFlight = true
    try {
      const update = await actions.check()
      if (!update || cancelled || promptedUpdateVersions.has(update.version)) return

      promptedUpdateVersions.add(update.version)
      let accept: boolean
      try {
        accept = await actions.ask(update.version)
      } catch (error) {
        promptedUpdateVersions.delete(update.version)
        throw error
      }
      if (!accept || cancelled) return

      await update.downloadAndInstall()
      if (!cancelled) await actions.relaunch()
    } catch (error) {
      warn(error)
    } finally {
      inFlight = false
    }
  }

  const requestCheck = () => {
    void check()
  }
  const checkOnActivation = () => {
    if (isVisible()) requestCheck()
  }

  const initialTimer = window.setTimeout(requestCheck, APP_UPDATE_INITIAL_DELAY_MS)
  const intervalTimer = window.setInterval(requestCheck, APP_UPDATE_INTERVAL_MS)
  window.addEventListener('focus', checkOnActivation)
  document.addEventListener('visibilitychange', checkOnActivation)

  return () => {
    cancelled = true
    window.clearTimeout(initialTimer)
    window.clearInterval(intervalTimer)
    window.removeEventListener('focus', checkOnActivation)
    document.removeEventListener('visibilitychange', checkOnActivation)
  }
}

export function useAppUpdater(): void {
  useEffect(() => {
    if (!isTauri()) return

    return startAppUpdaterChecks({
      check: async () => {
        const { check } = await import('@tauri-apps/plugin-updater')
        return await check()
      },
      ask: async (version) => {
        const { ask } = await import('@tauri-apps/plugin-dialog')
        return await ask(
          `Hay una nueva versión (${version}). ¿Querés actualizar ahora?`,
          {
            title: 'BMatrix Calendario',
            kind: 'info',
            okLabel: 'Actualizar',
            cancelLabel: 'Después',
          },
        )
      },
      relaunch: async () => {
        const { relaunch } = await import('@tauri-apps/plugin-process')
        await relaunch()
      },
    })
  }, [])
}
