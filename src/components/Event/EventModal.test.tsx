import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Calendar } from '../../types'
import { EventModal } from './EventModal'

const calendars: Calendar[] = [
  {
    id: 'cal-1',
    user_id: 'user-1',
    name: 'Personal',
    color: '#2F7FD4',
    is_default: true,
    visible: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
]

describe('EventModal', () => {
  it('no renderiza cuando está cerrado', () => {
    const { container } = render(
      <EventModal open={false} calendars={calendars} onClose={vi.fn()} onSave={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('exige título al guardar', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <EventModal
        open
        calendars={calendars}
        onClose={vi.fn()}
        onSave={onSave}
        initial={{
          calendar_id: 'cal-1',
          starts_at: '2026-08-05T10:00:00.000Z',
          ends_at: '2026-08-05T11:00:00.000Z',
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText('El título es obligatorio')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('guarda un evento nuevo con título', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <EventModal
        open
        calendars={calendars}
        onClose={onClose}
        onSave={onSave}
        initial={{
          calendar_id: 'cal-1',
          starts_at: '2026-08-05T10:00:00.000Z',
          ends_at: '2026-08-05T11:00:00.000Z',
        }}
      />,
    )

    await user.type(screen.getByLabelText(/Título/i), 'Standup')
    await user.selectOptions(screen.getByLabelText(/^Tipo$/i), 'task')
    await user.selectOptions(screen.getByLabelText(/Repetición/i), 'weekly')
    expect(screen.getByText(/Días de la semana/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].title).toBe('Standup')
    expect(onSave.mock.calls[0][0].kind).toBe('task')
    expect(onSave.mock.calls[0][0].rrule).toContain('FREQ=WEEKLY')
    expect(onClose).toHaveBeenCalled()
  })

  it('oculta fin en recordatorios', async () => {
    const user = userEvent.setup()
    render(
      <EventModal
        open
        calendars={calendars}
        onClose={vi.fn()}
        onSave={vi.fn()}
        initial={{
          calendar_id: 'cal-1',
          starts_at: '2026-08-05T10:00:00.000Z',
          ends_at: '2026-08-05T11:00:00.000Z',
          kind: 'reminder',
        }}
      />,
    )

    expect(screen.getByLabelText(/Fecha y hora/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Fin$/i)).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/^Tipo$/i), 'event')
    expect(screen.getByLabelText(/^Fin$/i)).toBeInTheDocument()
  })
})
