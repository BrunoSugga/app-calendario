import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TaskEndPromptWindow } from './TaskEndPromptWindow'

describe('TaskEndPromptWindow', () => {
  const initial = {
    eventId: 'task-1',
    title: 'Informe',
    endsAt: '2026-09-29T13:00:00.000Z',
  }

  it('pide una hora más cuando la tarea no terminó', async () => {
    const user = userEvent.setup()
    const onNo = vi.fn()
    render(<TaskEndPromptWindow initial={initial} onYes={vi.fn()} onNo={onNo} />)

    expect(screen.getByRole('heading', { name: 'Informe' })).toBeInTheDocument()
    expect(screen.getByText('¿Ya terminaste esta tarea?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No, una hora más' }))
    expect(onNo).toHaveBeenCalledWith('task-1')
  })

  it('marca la tarea como terminada', async () => {
    const user = userEvent.setup()
    const onYes = vi.fn()
    render(<TaskEndPromptWindow initial={initial} onYes={onYes} onNo={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Sí, ya terminó' }))
    expect(onYes).toHaveBeenCalledWith('task-1')
  })
})
