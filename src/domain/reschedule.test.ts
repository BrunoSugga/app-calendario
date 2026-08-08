import { describe, expect, it } from 'vitest'
import { withReagendadoPrefix } from './reschedule'

describe('withReagendadoPrefix', () => {
  it('prefija el título', () => {
    expect(withReagendadoPrefix('Reunión')).toBe('REAGENDADO · Reunión')
  })

  it('no duplica el prefijo', () => {
    expect(withReagendadoPrefix('REAGENDADO · Reunión')).toBe('REAGENDADO · Reunión')
    expect(withReagendadoPrefix('reagendado ayer')).toBe('reagendado ayer')
  })

  it('cubre título vacío', () => {
    expect(withReagendadoPrefix('')).toBe('REAGENDADO · Sin título')
  })
})
