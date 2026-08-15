import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  it('activa el organizador y permite volver a una vista calendario', async () => {
    const user = userEvent.setup()
    const onViewChange = vi.fn()
    const { rerender } = render(
      <Toolbar
        view="day"
        selectedDate={new Date(2026, 7, 15)}
        zoom={100}
        onViewChange={onViewChange}
        onNavigate={vi.fn()}
        onToday={vi.fn()}
        onZoom={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Organizador' }))
    expect(onViewChange).toHaveBeenCalledWith('organizer')
    expect(screen.getByRole('button', { name: /Hoy/ })).toHaveAttribute('aria-pressed', 'true')

    rerender(
      <Toolbar
        view="organizer"
        selectedDate={new Date(2026, 7, 15)}
        zoom={100}
        onViewChange={onViewChange}
        onNavigate={vi.fn()}
        onToday={vi.fn()}
        onZoom={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Organizador' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Hoy/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTitle('Alejar')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Semana' }))
    expect(onViewChange).toHaveBeenCalledWith('week')
  })
})
