import { describe, expect, it } from 'vitest'
import { createId } from './id'

describe('createId', () => {
  it('genera ids únicos no vacíos', () => {
    const a = createId()
    const b = createId()
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(a).not.toBe(b)
  })
})
