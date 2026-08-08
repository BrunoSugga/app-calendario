import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const authMock = {
  signIn: vi.fn(),
  signUpLocal: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn(),
  completePasswordSetup: vi.fn(),
  clearPasswordSetup: vi.fn(),
  clearAuthLinkError: vi.fn(),
  user: null,
  loading: false,
  isCloud: false,
  isAdmin: false,
  needsPasswordSetup: false,
  authLinkError: null as string | null,
}

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authMock,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    authMock.signIn.mockReset()
    authMock.signUpLocal.mockReset()
    authMock.requestPasswordReset.mockReset()
    authMock.isCloud = false
  })

  it('inicia sesión en modo local con correo', async () => {
    const user = userEvent.setup()
    authMock.signIn.mockResolvedValue(undefined)
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: 'BMatrix Calendario' })).toBeInTheDocument()
    expect(screen.getByAltText('BMatrix Calendario')).toBeInTheDocument()
    expect(screen.getByText(/Modo local/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Correo/i), 'bruno@example.com')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(authMock.signIn).toHaveBeenCalledWith('bruno@example.com', 'local')
  })

  it('cambia a registro local y crea cuenta', async () => {
    const user = userEvent.setup()
    authMock.signUpLocal.mockResolvedValue(undefined)
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /Crear una cuenta/i }))
    await user.type(screen.getByLabelText(/Nombre/i), 'Bruno')
    await user.type(screen.getByLabelText(/Correo/i), 'bruno@example.com')
    await user.click(screen.getByRole('button', { name: /Crear cuenta local/i }))

    expect(authMock.signUpLocal).toHaveBeenCalledWith('bruno@example.com', 'Bruno')
  })

  it('en cloud muestra contraseña, olvidé y sin registro público', async () => {
    const user = userEvent.setup()
    authMock.isCloud = true
    authMock.requestPasswordReset.mockResolvedValue(undefined)
    render(<LoginPage />)

    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument()
    expect(screen.getByText(/invitaron/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Crear una cuenta/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Olvidé mi contraseña/i }))
    await user.type(screen.getByLabelText(/Correo/i), 'bruno@gmail.com')
    await user.click(screen.getByRole('button', { name: /Enviar enlace/i }))

    expect(authMock.requestPasswordReset).toHaveBeenCalledWith('bruno@gmail.com')
  })
})
