import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const authMock = {
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  user: null,
  loading: false,
  isCloud: false,
}

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authMock,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    authMock.signIn.mockReset()
    authMock.signUp.mockReset()
    authMock.isCloud = false
  })

  it('inicia sesión en modo local con correo', async () => {
    const user = userEvent.setup()
    authMock.signIn.mockResolvedValue(undefined)
    render(<LoginPage />)

    expect(screen.getByText(/Modo local/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Correo/i), 'bruno@example.com')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(authMock.signIn).toHaveBeenCalledWith('bruno@example.com', 'local')
  })

  it('cambia a registro y crea cuenta', async () => {
    const user = userEvent.setup()
    authMock.signUp.mockResolvedValue(undefined)
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /Crear una cuenta/i }))
    await user.type(screen.getByLabelText(/Nombre/i), 'Bruno')
    await user.type(screen.getByLabelText(/Correo/i), 'bruno@example.com')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(authMock.signUp).toHaveBeenCalledWith(
      'bruno@example.com',
      'local',
      'Bruno',
    )
  })

  it('muestra contraseña en modo cloud', () => {
    authMock.isCloud = true
    render(<LoginPage />)
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument()
    expect(screen.getByText(/sincronizar entre dispositivos/i)).toBeInTheDocument()
  })
})
