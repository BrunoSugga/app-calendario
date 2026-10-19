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
})
