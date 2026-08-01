export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function openReminderWindow(payload: {
  title: string
  timeLabel: string
  calendarName: string
  description: string
  eventId: string
}): Promise<void> {
  if (!isTauri()) {
    window.alert(`${payload.title}\n${payload.timeLabel}\n${payload.calendarName}`)
    return
  }

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const label = `reminder-${payload.eventId.slice(0, 8)}-${Date.now()}`
  const params = new URLSearchParams({
    reminder: '1',
    title: payload.title,
    time: payload.timeLabel,
    calendar: payload.calendarName,
    description: payload.description,
    eventId: payload.eventId,
  })

  const win = new WebviewWindow(label, {
    url: `/?${params.toString()}`,
    title: 'Recordatorio',
    width: 380,
    height: 220,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    focus: true,
    decorations: true,
  })

  win.once('tauri://error', (event) => {
    console.error('No se pudo abrir recordatorio', event)
  })
}
