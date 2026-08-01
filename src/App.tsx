import { AuthProvider, useAuth } from './context/AuthContext'
import { CalendarDataProvider } from './context/CalendarDataContext'
import { LoginPage } from './components/Auth/LoginPage'
import { ReminderWindow } from './components/Reminder/ReminderWindow'
import { CalendarPage } from './pages/CalendarPage'

function isReminderRoute(): boolean {
  return new URLSearchParams(window.location.search).get('reminder') === '1'
}

function AppBody() {
  const { user, loading } = useAuth()

  if (isReminderRoute()) {
    return <ReminderWindow />
  }

  if (loading) {
    return <div className="login-page">Cargando BMatrix Calendario…</div>
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <CalendarDataProvider>
      <CalendarPage />
    </CalendarDataProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppBody />
    </AuthProvider>
  )
}
