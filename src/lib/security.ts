import type { EventDraft, EventKind } from '../types'
import { normalizeEventKind } from '../types'

const MAX_TITLE = 200
const MAX_DESCRIPTION = 5000
const MAX_NAME = 120
const MAX_COLOR = 32
const MAX_NOTE = 2000
const MAX_RRULE = 300
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SAFE_ID_RE = /^[A-Za-z0-9_-]{2,80}$/
const SAFE_TOKEN_RE = /^[A-Za-z0-9_-]{8,80}$/
const SAFE_ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.+-Z]+)?$/
const SAFE_RRULE_CHARS_RE = /^[A-Za-z0-9:;=,\n\r_/+-]+$/

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
  if (password.trim().length !== password.length || !password.trim()) {
    throw new Error('La contraseña no puede empezar o terminar con espacios')
  }
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) || !/\d/.test(password)) {
    throw new Error('La contraseña debe incluir al menos una letra y un número')
  }
}

/** Normaliza y valida email de invitación (cualquier dominio; solo admin puede invitar). */
export function assertInviteEmail(email: string): string {
  const next = email.trim().toLowerCase()
  if (!isValidEmail(next)) {
    throw new Error('Correo inválido')
  }
  return next
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

export function sanitizeTaskNote(note: string): string {
  return clampText(note, MAX_NOTE)
}

export function isSafeId(value: string): boolean {
  return SAFE_ID_RE.test(value)
}

export function isSafeIsoDate(value: string): boolean {
  if (typeof value !== 'string' || value.length < 10 || value.length > 40) return false
  if (!SAFE_ISO_RE.test(value)) return false
  const t = Date.parse(value)
  return Number.isFinite(t)
}

export function sanitizeRRule(rrule: string | null | undefined): string | null {
  if (!rrule) return null
  const next = clampText(rrule, MAX_RRULE)
  if (!next) return null
  if (!SAFE_RRULE_CHARS_RE.test(next)) {
    throw new Error('Regla de repetición inválida')
  }
  if (!/FREQ=(DAILY|WEEKLY|MONTHLY)/i.test(next)) {
    throw new Error('Regla de repetición inválida')
  }
  // Evita expansiones abusivas (ReDoS / bombas de ocurrencias)
  const count = /(?:^|;)COUNT=(\d+)/i.exec(next)
  if (count && Number(count[1]) > 366) {
    throw new Error('Regla de repetición inválida')
  }
  const interval = /(?:^|;)INTERVAL=(\d+)/i.exec(next)
  if (interval && Number(interval[1]) > 366) {
    throw new Error('Regla de repetición inválida')
  }
  if ((next.match(/\n/g) ?? []).length > 2) {
    throw new Error('Regla de repetición inválida')
  }
  return next
}

export function sanitizeEventDraft(draft: EventDraft): EventDraft {
  const title = clampText(draft.title, MAX_TITLE)
  if (!title) throw new Error('El título es obligatorio')

  if (draft.id && !isSafeId(draft.id)) {
    throw new Error('Identificador de evento inválido')
  }
  if (!isSafeId(draft.calendar_id)) {
    throw new Error('Calendario inválido')
  }

  const kind: EventKind = normalizeEventKind(draft.kind)
  const starts = new Date(draft.starts_at)
  let ends = new Date(draft.ends_at)

  if (kind === 'reminder') {
    ends = starts
  }

  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    throw new Error('Fecha de evento inválida')
  }
  if (kind !== 'reminder' && ends.getTime() < starts.getTime()) {
    throw new Error('El fin del evento debe ser posterior al inicio')
  }

  // Ventana razonable: ±20 años desde ahora
  const now = Date.now()
  const span = 20 * 365.25 * 24 * 60 * 60 * 1000
  if (starts.getTime() < now - span || starts.getTime() > now + span) {
    throw new Error('Fecha de evento fuera de rango')
  }

  const reminder = Number(draft.reminder_minutes)
  if (!Number.isFinite(reminder) || reminder < 0 || reminder > 7 * 24 * 60) {
    throw new Error('Recordatorio inválido')
  }

  return {
    ...draft,
    kind,
    title,
    description: clampText(draft.description ?? '', MAX_DESCRIPTION),
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    all_day: kind === 'reminder' ? false : draft.all_day,
    reminder_minutes: Math.floor(reminder),
    rrule: sanitizeRRule(draft.rrule),
  }
}

export function isSafeReminderToken(token: string): boolean {
  return SAFE_TOKEN_RE.test(token)
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
    "media-src 'self'",
    "worker-src 'none'",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    `connect-src ${connect}`,
  ].join('; ')
  document.head.appendChild(meta)
}
