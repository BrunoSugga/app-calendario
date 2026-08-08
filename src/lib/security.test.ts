import { describe, expect, it } from 'vitest'
import {
  assertCloudPassword,
  assertInviteEmail,
  isSafeId,
  isSafeIsoDate,
  isSafeReminderToken,
  isValidEmail,
  sanitizeColor,
  sanitizeEventDraft,
  sanitizeRRule,
} from './security'

describe('security helpers', () => {
  it('valida email y password', () => {
    expect(isValidEmail('bruno@example.com')).toBe(true)
    expect(isValidEmail('mal')).toBe(false)
    expect(() => assertCloudPassword('123')).toThrow(/8 caracteres/)
    expect(() => assertCloudPassword('abcdefgh')).toThrow(/letra y un número/)
    expect(() => assertCloudPassword('  abcd1234')).toThrow(/espacios/)
    expect(() => assertCloudPassword('abcd1234')).not.toThrow()
    expect(() => assertInviteEmail('user@bmatrix.org')).not.toThrow()
    expect(() => assertInviteEmail('user@gmail.com')).not.toThrow()
    expect(() => assertInviteEmail('user@camposur.com.uy')).not.toThrow()
    expect(() => assertInviteEmail('mal')).toThrow(/Correo inválido/)
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
      kind: 'event',
    })
    expect(draft.title).toBe('Hola')
    expect(draft.description.length).toBe(5000)
    expect(draft.kind).toBe('event')
  })

  it('fuerza ends_at = starts_at en recordatorios', () => {
    const draft = sanitizeEventDraft({
      calendar_id: 'c1',
      title: 'Llamar',
      description: '',
      starts_at: '2026-08-02T10:00:00.000Z',
      ends_at: '2026-08-02T11:00:00.000Z',
      all_day: true,
      reminder_minutes: 0,
      rrule: null,
      kind: 'reminder',
    })
    expect(draft.ends_at).toBe(draft.starts_at)
    expect(draft.all_day).toBe(false)
  })

  it('rechaza color inválido y tokens inseguros', () => {
    expect(sanitizeColor('#2F7FD4')).toBe('#2F7FD4')
    expect(() => sanitizeColor('red')).toThrow(/Color inválido/)
    expect(isSafeReminderToken('abc_123-XYZ')).toBe(true)
    expect(isSafeReminderToken('../evil')).toBe(false)
    expect(isSafeId('cal-1')).toBe(true)
    expect(isSafeId('../x')).toBe(false)
    expect(isSafeIsoDate('2026-08-02T10:00:00.000Z')).toBe(true)
    expect(isSafeIsoDate('not-a-date')).toBe(false)
  })

  it('acepta rrules del generador y rechaza abusivas', () => {
    const weekly = 'DTSTART:20260803T100000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE'
    expect(sanitizeRRule(weekly)).toBe(weekly)
    expect(() => sanitizeRRule('FREQ=DAILY;COUNT=99999')).toThrow(/inválida/)
    expect(() => sanitizeRRule('FREQ=YEARLY')).toThrow(/inválida/)
    expect(() => sanitizeRRule('javascript:alert(1)')).toThrow(/inválida/)
  })

  it('no permite service_role ni patrones peligrosos en inputs de texto acotados', () => {
    expect(() =>
      sanitizeEventDraft({
        calendar_id: 'c1',
        title: '',
        description: '',
        starts_at: '2026-08-02T10:00:00.000Z',
        ends_at: '2026-08-02T11:00:00.000Z',
        all_day: false,
        reminder_minutes: 15,
        rrule: null,
        kind: 'event',
      }),
    ).toThrow(/título/i)
    expect(() =>
      sanitizeEventDraft({
        calendar_id: '../hack',
        title: 'x',
        description: '',
        starts_at: '2026-08-02T10:00:00.000Z',
        ends_at: '2026-08-02T11:00:00.000Z',
        all_day: false,
        reminder_minutes: 15,
        rrule: null,
        kind: 'event',
      }),
    ).toThrow(/Calendario inválido/)
  })
})
