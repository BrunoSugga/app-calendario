import { describe, expect, it } from 'vitest'
import {
  assertCloudPassword,
  isSafeReminderToken,
  isValidEmail,
  sanitizeColor,
  sanitizeEventDraft,
} from './security'

describe('security helpers', () => {
  it('valida email y password', () => {
    expect(isValidEmail('bruno@example.com')).toBe(true)
    expect(isValidEmail('mal')).toBe(false)
    expect(() => assertCloudPassword('123')).toThrow(/8 caracteres/)
    expect(() => assertCloudPassword('12345678')).not.toThrow()
  })

  it('sanitiza drafts de evento', () => {
    const draft = sanitizeEventDraft({
      calendar_id: 'c1',
      title: '  Hola  ',
      description: 'x'.repeat(6000),
      starts_at: '2026-08-02T10:00:00.000Z',
      ends_at: '2026-08-02T11:00:00.000Z',
      all_day: false,
      reminder_minutes: 15,
      rrule: null,
    })
    expect(draft.title).toBe('Hola')
    expect(draft.description.length).toBe(5000)
  })

  it('rechaza color inválido y tokens inseguros', () => {
    expect(sanitizeColor('#2F7FD4')).toBe('#2F7FD4')
    expect(() => sanitizeColor('red')).toThrow(/Color inválido/)
    expect(isSafeReminderToken('abc_123-XYZ')).toBe(true)
    expect(isSafeReminderToken('../evil')).toBe(false)
  })
})
