import type { Calendar } from '../types'

export type DeviceCalendarPrefs = {
  defaultCalendarId: string | null
  hiddenIds: string[]
}

const KEY_PREFIX = 'calendario.device.calendars.v1.'

export function devicePrefsKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

export function loadDevicePrefs(userId: string): DeviceCalendarPrefs | null {
  try {
    const raw = localStorage.getItem(devicePrefsKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as Record<string, unknown>
    const defaultCalendarId =
      typeof obj.defaultCalendarId === 'string'
        ? obj.defaultCalendarId
        : obj.defaultCalendarId === null
          ? null
          : null
    const hiddenIds = Array.isArray(obj.hiddenIds)
      ? obj.hiddenIds.filter((id): id is string => typeof id === 'string')
      : []
    return { defaultCalendarId, hiddenIds }
  } catch {
    return null
  }
}

export function saveDevicePrefs(userId: string, prefs: DeviceCalendarPrefs): void {
  localStorage.setItem(devicePrefsKey(userId), JSON.stringify(prefs))
}

export function seedDevicePrefsFromCalendars(calendars: Calendar[]): DeviceCalendarPrefs {
  const defaultCal = calendars.find((c) => c.is_default) ?? calendars[0]
  return {
    defaultCalendarId: defaultCal?.id ?? null,
    hiddenIds: calendars.filter((c) => !c.visible).map((c) => c.id),
  }
}

/** Resuelve prefs: carga o siembra desde calendarios; limpia ids huérfanos. */
export function resolveDevicePrefs(
  userId: string,
  calendars: Calendar[],
): DeviceCalendarPrefs {
  const existing = loadDevicePrefs(userId)
  const ids = new Set(calendars.map((c) => c.id))
  const seeded = existing ?? seedDevicePrefsFromCalendars(calendars)
  const hiddenIds = seeded.hiddenIds.filter((id) => ids.has(id))
  let defaultCalendarId =
    seeded.defaultCalendarId && ids.has(seeded.defaultCalendarId)
      ? seeded.defaultCalendarId
      : (calendars.find((c) => c.is_default)?.id ?? calendars[0]?.id ?? null)

  const prefs: DeviceCalendarPrefs = { defaultCalendarId, hiddenIds }
  if (
    !existing ||
    existing.defaultCalendarId !== prefs.defaultCalendarId ||
    existing.hiddenIds.length !== prefs.hiddenIds.length ||
    existing.hiddenIds.some((id, i) => id !== prefs.hiddenIds[i])
  ) {
    saveDevicePrefs(userId, prefs)
  }
  return prefs
}

export function applyDevicePrefs(
  calendars: Calendar[],
  prefs: DeviceCalendarPrefs,
): Calendar[] {
  const hidden = new Set(prefs.hiddenIds)
  const defaultId =
    prefs.defaultCalendarId && calendars.some((c) => c.id === prefs.defaultCalendarId)
      ? prefs.defaultCalendarId
      : (calendars[0]?.id ?? null)

  return calendars.map((c) => ({
    ...c,
    is_default: c.id === defaultId,
    visible: !hidden.has(c.id),
  }))
}

export function toggleHiddenInPrefs(
  prefs: DeviceCalendarPrefs,
  calendarId: string,
): DeviceCalendarPrefs {
  const hidden = new Set(prefs.hiddenIds)
  if (hidden.has(calendarId)) hidden.delete(calendarId)
  else hidden.add(calendarId)
  return { ...prefs, hiddenIds: [...hidden] }
}

export function setDefaultInPrefs(
  prefs: DeviceCalendarPrefs,
  calendarId: string,
): DeviceCalendarPrefs {
  return { ...prefs, defaultCalendarId: calendarId }
}

/** Tras borrar un calendario, limpia prefs. */
export function pruneDevicePrefsAfterDelete(
  prefs: DeviceCalendarPrefs,
  deletedId: string,
  remainingIds: string[],
): DeviceCalendarPrefs {
  const hiddenIds = prefs.hiddenIds.filter((id) => id !== deletedId && remainingIds.includes(id))
  let defaultCalendarId = prefs.defaultCalendarId
  if (defaultCalendarId === deletedId || (defaultCalendarId && !remainingIds.includes(defaultCalendarId))) {
    defaultCalendarId = remainingIds[0] ?? null
  }
  return { defaultCalendarId, hiddenIds }
}
