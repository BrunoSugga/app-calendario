import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumeQueuedTaskEndClosed, storeTaskEndPayload } from '../../lib/tauri'
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

describe('TaskEndPromptWindow al recargar', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  function openStored() {
    const token = storeTaskEndPayload({
      eventId: 'task-1',
      title: 'Informe',
      endsAt: '2026-09-29T13:00:00.000Z',
    })
    window.history.replaceState({}, '', `/?task-end=1&t=${token}`)
    return render(<TaskEndPromptWindow />)
  }

  it('F5 no da por cerrado el aviso y lo vuelve a mostrar', () => {
    const view = openStored()
    expect(screen.getByRole('heading', { name: 'Informe' })).toBeInTheDocument()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }))
    window.dispatchEvent(new Event('pagehide'))
    expect(consumeQueuedTaskEndClosed()).toBeNull()

    view.unmount()
    render(<TaskEndPromptWindow />)
    expect(screen.getByRole('heading', { name: 'Informe' })).toBeInTheDocument()
    expect(screen.queryByText('El aviso expiró o no es válido.')).not.toBeInTheDocument()
  })

  it('cerrar la ventana avisa a la principal', () => {
    openStored()
    window.dispatchEvent(new Event('pagehide'))
    expect(consumeQueuedTaskEndClosed()).toBe('task-1')
  })
})
