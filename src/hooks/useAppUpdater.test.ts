import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_UPDATE_ACTIVATION_COOLDOWN_MS,
  APP_UPDATE_INITIAL_DELAY_MS,
  APP_UPDATE_INTERVAL_MS,
  startAppUpdaterChecks,
  type AppUpdaterActions,
} from './useAppUpdater'

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

function updaterActions(overrides: Partial<AppUpdaterActions> = {}): AppUpdaterActions {
  return {
    check: vi.fn().mockResolvedValue(null),
    ask: vi.fn().mockResolvedValue(false),
    relaunch: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn(),
    ...overrides,
  }
}

describe('startAppUpdaterChecks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T15:00:00.000Z'))
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('chequea al inicio y periódicamente sin repetir el aviso de la misma versión', async () => {
    const update = {
      version: '1.3.0',
      downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    }
    const actions = updaterActions({
      check: vi.fn().mockResolvedValue(update),
      ask: vi.fn().mockResolvedValue(false),
    })
    const stop = startAppUpdaterChecks(actions)

    await vi.advanceTimersByTimeAsync(APP_UPDATE_INITIAL_DELAY_MS)
    expect(actions.check).toHaveBeenCalledTimes(1)
    expect(actions.ask).toHaveBeenCalledWith('1.3.0')

    await vi.advanceTimersByTimeAsync(APP_UPDATE_INTERVAL_MS)
    expect(actions.check).toHaveBeenCalledTimes(2)
    expect(actions.ask).toHaveBeenCalledTimes(1)

    stop()
  })

  it('rechequea al recuperar foco solo después del cooldown', async () => {
    const actions = updaterActions()
    const stop = startAppUpdaterChecks(actions)

    await vi.advanceTimersByTimeAsync(APP_UPDATE_INITIAL_DELAY_MS)
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(actions.check).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(APP_UPDATE_ACTIVATION_COOLDOWN_MS)
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(actions.check).toHaveBeenCalledTimes(2)

    stop()
  })

  it('omite chequeos ocultos y prueba al volver a estar visible', async () => {
    const actions = updaterActions()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    const stop = startAppUpdaterChecks(actions)

    await vi.advanceTimersByTimeAsync(APP_UPDATE_INITIAL_DELAY_MS)
    expect(actions.check).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(actions.check).toHaveBeenCalledTimes(1)

    stop()
  })

  it('se recupera de errores y evita chequeos concurrentes', async () => {
    let rejectFirst!: (error: Error) => void
    const firstCheck = new Promise<null>((_, reject) => {
      rejectFirst = reject
    })
    const check = vi
      .fn<() => Promise<null>>()
      .mockReturnValueOnce(firstCheck)
      .mockResolvedValueOnce(null)
    const actions = updaterActions({ check })
    const stop = startAppUpdaterChecks(actions)

    await vi.advanceTimersByTimeAsync(APP_UPDATE_INITIAL_DELAY_MS)
    await vi.advanceTimersByTimeAsync(APP_UPDATE_ACTIVATION_COOLDOWN_MS)
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(check).toHaveBeenCalledTimes(1)

    rejectFirst(new Error('sin red'))
    await flushPromises()
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(check).toHaveBeenCalledTimes(2)
    expect(actions.warn).toHaveBeenCalledTimes(1)

    stop()
  })

  it('descarga y relanza cuando el usuario acepta', async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined)
    const actions = updaterActions({
      check: vi.fn().mockResolvedValue({ version: '1.4.0', downloadAndInstall }),
      ask: vi.fn().mockResolvedValue(true),
    })
    const stop = startAppUpdaterChecks(actions)

    await vi.advanceTimersByTimeAsync(APP_UPDATE_INITIAL_DELAY_MS)
    expect(downloadAndInstall).toHaveBeenCalledTimes(1)
    expect(actions.relaunch).toHaveBeenCalledTimes(1)

    stop()
  })
})
