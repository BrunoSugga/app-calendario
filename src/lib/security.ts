import type { EventDraft } from '../types'

const MAX_TITLE = 200
const MAX_DESCRIPTION = 5000
const MAX_NAME = 120
const MAX_COLOR = 32
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function clampText(value: string, max: number): string {
  return value.trim().slice(0, max)
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254
}

export function assertCloudPassword(password: string): void {
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres')
  }
  if (password.length > 128) {
    throw new Error('La contraseña es demasiado larga')
  }
}

export function sanitizeCalendarName(name: string): string {
  const next = clampText(name, MAX_NAME)
  if (!next) throw new Error('El nombre del calendario es obligatorio')
  return next
}

export function sanitizeColor(color: string): string {
  const next = clampText(color, MAX_COLOR)
  if (!/^#[0-9a-fA-F]{6}$/.test(next)) {
    throw new Error('Color inválido')
  }
  return next.toUpperCase()
}

export function sanitizeEventDraft(draft: EventDraft): EventDraft {
  const title = clampText(draft.title, MAX_TITLE)
  if (!title) throw new Error('El título es obligatorio')

  const starts = new Date(draft.starts_at)
  const ends = new Date(draft.ends_at)
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    throw new Error('Fecha de evento inválida')
  }
  if (ends.getTime() < starts.getTime()) {
    throw new Error('El fin del evento debe ser posterior al inicio')
  }

  const reminder = Number(draft.reminder_minutes)
  if (!Number.isFinite(reminder) || reminder < 0 || reminder > 7 * 24 * 60) {
    throw new Error('Recordatorio inválido')
  }

  return {
    ...draft,
    title,
    description: clampText(draft.description ?? '', MAX_DESCRIPTION),
    reminder_minutes: Math.floor(reminder),
    rrule: draft.rrule ? clampText(draft.rrule, 1000) : null,
  }
}

export function isSafeReminderToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{8,80}$/.test(token)
}

export function applyWebCsp(): void {
  if (!import.meta.env.PROD) return
  if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) return

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  let connect = "'self'"
  if (supabaseUrl?.startsWith('https://')) {
    try {
      const host = new URL(supabaseUrl).origin
      connect += ` ${host} ${host.replace('https://', 'wss://')}`
    } catch {
      // ignore
    }
  }

  const meta = document.createElement('meta')
  meta.httpEquiv = 'Content-Security-Policy'
  meta.content = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    `connect-src ${connect}`,
  ].join('; ')
  document.head.appendChild(meta)
}
