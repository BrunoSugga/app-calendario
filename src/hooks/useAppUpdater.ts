import { useEffect } from 'react'
import { isTauri } from '../lib/tauri'

export function useAppUpdater(): void {
  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false

    async function check() {
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const { ask } = await import('@tauri-apps/plugin-dialog')
        const { relaunch } = await import('@tauri-apps/plugin-process')

        const update = await check()
        if (!update || cancelled) return

        const accept = await ask(
          `Hay una nueva versión (${update.version}). ¿Querés actualizar ahora?`,
          {
            title: 'BMatrix Calendario',
            kind: 'info',
            okLabel: 'Actualizar',
            cancelLabel: 'Después',
          },
        )
        if (!accept || cancelled) return

        await update.downloadAndInstall()
        await relaunch()
      } catch (err) {
        console.warn('No se pudo verificar actualizaciones', err)
      }
    }

    const timer = window.setTimeout(() => {
      void check()
    }, 2500)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])
}
