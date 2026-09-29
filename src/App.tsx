import { AuthProvider, useAuth } from './context/AuthContext'
import { CalendarDataProvider } from './context/CalendarDataContext'
import { LoginPage } from './components/Auth/LoginPage'
import { SetPasswordPage } from './components/Auth/SetPasswordPage'
import { ReminderWindow } from './components/Reminder/ReminderWindow'
import { TaskEndPromptWindow } from './components/Reminder/TaskEndPromptWindow'
import { CalendarPage } from './pages/CalendarPage'

function isReminderRoute(): boolean {
  return new URLSearchParams(window.location.search).get('reminder') === '1'
}

function isTaskEndRoute(): boolean {
  return new URLSearchParams(window.location.search).get('task-end') === '1'
}

function AppBody() {
  const { user, loading, needsPasswordSetup } = useAuth()

  if (isReminderRoute()) {
    return <ReminderWindow />
  }

  if (isTaskEndRoute()) {
    return <TaskEndPromptWindow />
  }

  if (loading) {
    return <div className="login-page">Cargando BMatrix Calendario…</div>
  }

  if (needsPasswordSetup) {
    return <SetPasswordPage />
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
