import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import packageJson from '../../../package.json'
import { Sidebar } from './Sidebar'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { displayName: 'Usuario de prueba' },
    signOut: vi.fn(),
    isCloud: false,
    isAdmin: false,
  }),
}))

vi.mock('../../context/CalendarDataContext', () => ({
  useCalendarData: () => ({
    calendars: [],
    events: [],
    exceptions: [],
    toggleCalendarVisible: vi.fn(),
    setDefaultCalendar: vi.fn(),
  }),
}))

vi.mock('../../lib/platform', () => ({
  isCapacitor: () => false,
}))

vi.mock('../../lib/tauri', () => ({
  isTauri: () => false,
}))

vi.mock('../Auth/InviteUserModal', () => ({
  InviteUserModal: () => null,
}))

vi.mock('./ManageCalendarsModal', () => ({
  ManageCalendarsModal: () => null,
}))

vi.mock('./MiniCalendar', () => ({
  MiniCalendar: () => null,
}))

vi.mock('./WorkWeekModal', () => ({
  WorkWeekModal: () => null,
}))

describe('Sidebar', () => {
  it('muestra la versión canónica como información no interactiva en ajustes', () => {
    render(
      <Sidebar
        selectedDate={new Date(2026, 7, 15)}
        onSelectDate={vi.fn()}
        onOpenOccurrence={vi.fn()}
        pendingTasksOnly={false}
        onPendingTasksOnlyChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }))

    const version = screen.getByLabelText('Versión de la aplicación')
    expect(version.tagName).toBe('DIV')
    expect(within(version).getByText('Versión')).toBeInTheDocument()
    expect(within(version).getByText(`v${packageJson.version}`)).toBeInTheDocument()
    expect(version.querySelector('button, a, input, [role="menuitem"]')).toBeNull()
  })
})
