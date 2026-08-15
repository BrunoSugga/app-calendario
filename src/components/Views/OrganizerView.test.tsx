import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Calendar, CalendarEvent } from '../../types'
import { OrganizerView } from './OrganizerView'

const calendar: Calendar = {
  id: 'cal-1',
  user_id: 'user-1',
  name: 'Personal',
  color: '#2F7FD4',
  is_default: true,
  visible: true,
  created_at: '2026-01-01T00:00:00.000Z',
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    user_id: 'user-1',
    calendar_id: calendar.id,
    title: 'Reunión futura',
    description: 'Sala principal',
    starts_at: '2090-08-20T13:00:00.000Z',
    ends_at: '2090-08-20T14:00:00.000Z',
    all_day: false,
    reminder_minutes: 15,
    rrule: null,
    kind: 'event',
    task_status: null,
    task_started_at: null,
    task_completed_at: null,
    task_duration_ms: null,
    task_note: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('OrganizerView', () => {
  it('muestra, filtra y abre acciones de un evento futuro', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onDelete = vi.fn()
    render(
      <OrganizerView
        events={[event()]}
        calendars={[calendar]}
        exceptions={[]}
        onOpenOccurrence={onOpen}
        onDeleteOccurrence={onDelete}
      />,
    )

    expect(screen.getByText('Próximos (1)')).toBeInTheDocument()
    expect(screen.getByText('Reunión futura')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onDelete).toHaveBeenCalledTimes(1)

    await user.type(screen.getByLabelText('Buscar'), 'inexistente')
    expect(screen.getByText(/no hay próximos eventos que coincidan/i)).toBeInTheDocument()
  })

  it('filtra por tipo y estado de tarea', async () => {
    const user = userEvent.setup()
    render(
      <OrganizerView
        events={[
          event({
            id: 'task-1',
            title: 'Preparar informe',
            kind: 'task',
            task_status: 'in_progress',
          }),
          event({ id: 'event-1' }),
        ]}
        calendars={[calendar]}
        exceptions={[]}
        onOpenOccurrence={vi.fn()}
        onDeleteOccurrence={vi.fn()}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Tipo'), 'task')
    await user.selectOptions(screen.getByLabelText('Estado de tarea'), 'in_progress')
    expect(screen.getByText('Preparar informe')).toBeInTheDocument()
    expect(screen.queryByText('Reunión futura')).not.toBeInTheDocument()
  })
})
