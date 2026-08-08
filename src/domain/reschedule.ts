const REAGENDADO_PREFIX = 'REAGENDADO · '

export function withReagendadoPrefix(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return `${REAGENDADO_PREFIX}Sin título`
  if (trimmed.toUpperCase().startsWith('REAGENDADO')) return trimmed
  return `${REAGENDADO_PREFIX}${trimmed}`
}

export function clearFiredForEvent(eventId: string): void {
  try {
    const raw = localStorage.getItem('calendario.reminders.fired')
    const list = raw ? (JSON.parse(raw) as string[]) : []
    const next = list.filter((key) => !key.startsWith(`${eventId}:`))
    localStorage.setItem('calendario.reminders.fired', JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function clearSnoozeForEvent(eventId: string): void {
  try {
    localStorage.removeItem(`calendario.snooze.${eventId}`)
  } catch {
    // ignore
  }
}

export function clearReminderStateForEvent(eventId: string): void {
  clearSnoozeForEvent(eventId)
  clearFiredForEvent(eventId)
}
