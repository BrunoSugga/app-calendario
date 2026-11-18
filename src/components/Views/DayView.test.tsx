import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Occurrence } from '../../types'
import { DayView } from './DayView'

function reminder(id: string, title: string): Occurrence {
  const at = new Date(2026, 9, 19, 16, 0, 0, 0)
  return {
    eventId: id,
    calendarId: 'cal-1',
    title,
    description: '',
    startsAt: at,
    endsAt: at,
    allDay: false,
    reminderMinutes: 0,
    color: '#2F7FD4',
    isRecurring: true,
    originalStartsAt: at,
    kind: 'reminder',
    taskStatus: null,
  }
}

describe('DayView', () => {
  it('muestra los dos recordatorios periódicos de duración cero en el mismo horario', () => {
    const day = new Date(2026, 9, 19, 11, 48, 0, 0)
    render(
      <DayView
        date={day}
        occurrences={[reminder('liq', 'Descargar liq 16'), reminder('fa', 'Mandar detalle fa ruiz')]}
        zoom={100}
        onSlotClick={vi.fn()}
        onOccurrenceClick={vi.fn()}
      />,
    )

    const descargar = screen.getByRole('button', { name: /Descargar liq 16/ })
    const detalle = screen.getByRole('button', { name: /Mandar detalle fa ruiz/ })
    expect(descargar).toHaveAttribute('data-column', '0')
    expect(detalle).toHaveAttribute('data-column', '1')
    expect(descargar).toHaveAttribute('data-columns', '2')
    expect(detalle).toHaveAttribute('data-columns', '2')
    expect(descargar.style.left).toBe('4px')
    expect(detalle.style.left).not.toBe(descargar.style.left)
    expect(descargar.style.width).toContain('50%')
    expect(detalle.style.width).toContain('50%')
  })

  it('separa en columnas dos recordatorios cercanos que se pintarían uno encima del otro', () => {
    const day = new Date(2026, 9, 19, 11, 48, 0, 0)
    const early = reminder('camaras', 'Mirar cámaras')
    early.startsAt = new Date(2026, 9, 19, 15, 20, 0, 0)
    early.endsAt = early.startsAt
    early.originalStartsAt = early.startsAt
    const later = reminder('tata', 'Confirmar tata')
    later.startsAt = new Date(2026, 9, 19, 15, 37, 0, 0)
    later.endsAt = later.startsAt
    later.originalStartsAt = later.startsAt

    render(
      <DayView
        date={day}
        occurrences={[early, later]}
        zoom={100}
        onSlotClick={vi.fn()}
        onOccurrenceClick={vi.fn()}
      />,
    )

    const camaras = screen.getByRole('button', { name: /Mirar cámaras/ })
    const tata = screen.getByRole('button', { name: /Confirmar tata/ })
    expect(camaras).toHaveAttribute('data-column', '0')
    expect(tata).toHaveAttribute('data-column', '1')
    expect(camaras).toHaveAttribute('data-columns', '2')
    expect(tata).toHaveAttribute('data-columns', '2')
    expect(camaras.style.left).not.toBe(tata.style.left)
  })

  it('compacta el texto cuando hay tres columnas', () => {
    const day = new Date(2026, 9, 19, 11, 48, 0, 0)
    const slots = [0, 10, 20].map((minute, index) => {
      const item = reminder(`r${index}`, `Aviso ${index}`)
      const at = new Date(2026, 9, 19, 15, minute, 0, 0)
      item.startsAt = at
      item.endsAt = at
      item.originalStartsAt = at
      return item
    })

    render(
      <DayView
        date={day}
        occurrences={slots}
        zoom={100}
        onSlotClick={vi.fn()}
        onOccurrenceClick={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Aviso 2/ }).className).toContain('narrow')
  })
})
