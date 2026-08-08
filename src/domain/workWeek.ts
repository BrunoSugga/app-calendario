/** ISO weekday: Monday = 1 … Sunday = 7 */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type WorkWeekSettings = {
  workCalendarId: string | null
  workDays: IsoWeekday[]
  startMinute: number
  endMinute: number
  muteOutsideHours: boolean
}

export const DEFAULT_WORK_WEEK: WorkWeekSettings = {
  workCalendarId: null,
  workDays: [1, 2, 3, 4, 5],
  startMinute: 8 * 60,
  endMinute: 17 * 60,
  muteOutsideHours: false,
}

export const WORK_DAY_LABELS: { day: IsoWeekday; short: string }[] = [
  { day: 1, short: 'L' },
  { day: 2, short: 'M' },
  { day: 3, short: 'X' },
  { day: 4, short: 'J' },
  { day: 5, short: 'V' },
  { day: 6, short: 'S' },
  { day: 7, short: 'D' },
]

export function isoWeekday(date: Date): IsoWeekday {
  const day = date.getDay()
  return (day === 0 ? 7 : day) as IsoWeekday
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function minutesToTimeInput(minute: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.floor(minute)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function timeInputToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null
  }
  return h * 60 + m
}

function atMinuteOnDay(day: Date, minute: number): Date {
  const result = new Date(day)
  result.setHours(0, 0, 0, 0)
  result.setMinutes(minute, 0, 0)
  return result
}

export function isWithinWorkHours(now: Date, settings: WorkWeekSettings): boolean {
  if (settings.workDays.length === 0) return false
  if (!settings.workDays.includes(isoWeekday(now))) return false
  const m = minutesOfDay(now)
  return m >= settings.startMinute && m < settings.endMinute
}

/** True when mute applies to this calendar id. */
export function isWorkCalendarMuted(
  settings: WorkWeekSettings,
  calendarId: string,
): boolean {
  return (
    settings.muteOutsideHours &&
    settings.workCalendarId != null &&
    settings.workCalendarId === calendarId
  )
}

/**
 * Fin de la jornada laboral previa (ancla del lookback diferido).
 * Si ahora estás dentro de jornada, es el fin del día laboral anterior.
 */
export function previousWorkPeriodEnd(now: Date, settings: WorkWeekSettings): Date {
  const days = new Set(settings.workDays)
  for (let offset = 0; offset < 14; offset++) {
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - offset)
    if (!days.has(isoWeekday(day))) continue

    const periodStart = atMinuteOnDay(day, settings.startMinute)
    const periodEnd = atMinuteOnDay(day, settings.endMinute)

    if (offset === 0) {
      if (now >= periodEnd) return periodEnd
      if (now >= periodStart) continue
      continue
    }
    return periodEnd
  }

  const fallback = new Date(now)
  fallback.setDate(fallback.getDate() - 7)
  return fallback
}

export function normalizeWorkWeekSettings(raw: unknown): WorkWeekSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WORK_WEEK }
  const obj = raw as Record<string, unknown>

  const workCalendarId =
    typeof obj.workCalendarId === 'string' && obj.workCalendarId
      ? obj.workCalendarId
      : typeof obj.work_calendar_id === 'string' && obj.work_calendar_id
        ? obj.work_calendar_id
        : null

  const rawDays = obj.workDays ?? obj.work_days
  const workDays = Array.isArray(rawDays)
    ? ([...new Set(
        rawDays
          .map((d) => Number(d))
          .filter((d): d is IsoWeekday => d >= 1 && d <= 7),
      )] as IsoWeekday[]).sort((a, b) => a - b)
    : [...DEFAULT_WORK_WEEK.workDays]

  const startMinute = Number(obj.startMinute ?? obj.start_minute)
  const endMinute = Number(obj.endMinute ?? obj.end_minute)

  return {
    workCalendarId,
    workDays: workDays.length > 0 ? workDays : [...DEFAULT_WORK_WEEK.workDays],
    startMinute:
      Number.isFinite(startMinute) && startMinute >= 0 && startMinute < 1440
        ? Math.floor(startMinute)
        : DEFAULT_WORK_WEEK.startMinute,
    endMinute:
      Number.isFinite(endMinute) && endMinute > 0 && endMinute <= 1440
        ? Math.floor(endMinute)
        : DEFAULT_WORK_WEEK.endMinute,
    muteOutsideHours: Boolean(obj.muteOutsideHours ?? obj.mute_outside_hours),
  }
}

export function assertValidWorkWeekSettings(settings: WorkWeekSettings): void {
  if (settings.workDays.length === 0) {
    throw new Error('Elegí al menos un día laboral')
  }
  if (
    settings.startMinute < 0 ||
    settings.startMinute >= 1440 ||
    settings.endMinute <= 0 ||
    settings.endMinute > 1440 ||
    settings.startMinute >= settings.endMinute
  ) {
    throw new Error('El horario de inicio debe ser anterior al de fin')
  }
}
