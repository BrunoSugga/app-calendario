import { describe, expect, it } from 'vitest'
import { eventBlockBox, layoutTimedEvents, minVisualSpanMs } from './eventLayout'

function at(hour: number, minute = 0): Date {
  return new Date(2026, 9, 19, hour, minute, 0, 0)
}

describe('layoutTimedEvents', () => {
  it('pone en columnas distintas dos recordatorios de duración cero a la misma hora', () => {
    const instant = at(16)
    const laid = layoutTimedEvents([
      { id: 'descargar', startsAt: instant, endsAt: instant },
      { id: 'detalle', startsAt: instant, endsAt: instant },
    ])

    expect(laid.map((entry) => entry.item.id)).toEqual(['descargar', 'detalle'])
    expect(laid.map((entry) => entry.column)).toEqual([0, 1])
    expect(laid.every((entry) => entry.columns === 2)).toBe(true)
    expect(eventBlockBox(laid[0].column, laid[0].columns).left).not.toBe(
      eventBlockBox(laid[1].column, laid[1].columns).left,
    )
  })

  it('no parte un bloque que solo se apoya en el borde final de otro', () => {
    const laid = layoutTimedEvents([
      { id: 'antes', startsAt: at(15), endsAt: at(16) },
      { id: 'en-el-borde', startsAt: at(16), endsAt: at(16) },
    ])

    expect(laid.map((entry) => entry.columns)).toEqual([1, 1])
    expect(laid.map((entry) => entry.column)).toEqual([0, 0])
  })

  it('comparte columna si el instante cae justo en el inicio de otro bloque', () => {
    const laid = layoutTimedEvents([
      { id: 'punto', startsAt: at(16), endsAt: at(16) },
      { id: 'bloque', startsAt: at(16), endsAt: at(17) },
    ])

    expect(laid.map((entry) => entry.column).sort()).toEqual([0, 1])
    expect(laid.every((entry) => entry.columns === 2)).toBe(true)
  })

  it('deja el ancho completo cuando no hay solape', () => {
    expect(eventBlockBox(0, 1)).toEqual({ left: '4px', width: 'auto', right: '4px' })
  })

  it('separa dos recordatorios a 15 minutos cuando la huella visual se solapa', () => {
    const laid = layoutTimedEvents(
      [
        { id: 'quince', startsAt: at(15, 20), endsAt: at(15, 20) },
        { id: 'treinta', startsAt: at(15, 37), endsAt: at(15, 37) },
      ],
      { minSpanMs: 25 * 60 * 1000 },
    )

    expect(laid.map((entry) => entry.column)).toEqual([0, 1])
    expect(laid.every((entry) => entry.columns === 2)).toBe(true)
  })

  it('parte un recordatorio en el borde si la huella visual del bloque lo cruza', () => {
    const laid = layoutTimedEvents(
      [
        { id: 'bloque', startsAt: at(15, 50), endsAt: at(16) },
        { id: 'punto', startsAt: at(16), endsAt: at(16) },
      ],
      { minSpanMs: 25 * 60 * 1000 },
    )

    expect(laid.map((entry) => entry.column).sort()).toEqual([0, 1])
    expect(laid.every((entry) => entry.columns === 2)).toBe(true)
  })

  it('no estira un bloque que ya dura más que la huella visual', () => {
    const laid = layoutTimedEvents(
      [
        { id: 'largo', startsAt: at(15), endsAt: at(16) },
        { id: 'en-el-borde', startsAt: at(16), endsAt: at(16) },
      ],
      { minSpanMs: 25 * 60 * 1000 },
    )

    expect(laid.map((entry) => entry.columns)).toEqual([1, 1])
    expect(laid.map((entry) => entry.column)).toEqual([0, 0])
  })
})

describe('minVisualSpanMs', () => {
  it('convierte el alto mínimo en minutos según la escala de la hora', () => {
    expect(minVisualSpanMs(22, 48)).toBe((22 / 48) * 60 * 60 * 1000)
    expect(minVisualSpanMs(20, 96)).toBe((20 / 96) * 60 * 60 * 1000)
  })

  it('cae a 1 ms si la escala no es usable', () => {
    expect(minVisualSpanMs(0, 48)).toBe(1)
    expect(minVisualSpanMs(22, 0)).toBe(1)
    expect(minVisualSpanMs(-4, 48)).toBe(1)
    expect(minVisualSpanMs(Number.NaN, 48)).toBe(1)
    expect(minVisualSpanMs(22, Number.POSITIVE_INFINITY)).toBe(1)
  })
})
