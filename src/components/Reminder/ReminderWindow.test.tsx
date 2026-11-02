import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isOccurrenceDueForReminder, reminderFireKey } from '../../domain/reminders'
import { ReminderWindow } from './ReminderWindow'

describe('ReminderWindow aplazar', () => {
  const eventId = 'evt-bocata'
  const originalStartsAt = '2026-11-02T09:25:00.000-03:00'
  const fireKey = reminderFireKey(eventId, new Date(originalStartsAt))

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('calendario.reminders.fired', JSON.stringify([fireKey]))
    vi.stubGlobal(
      'Audio',
      class {
        volume = 1
        play(): Promise<void> {
          return Promise.resolve()
        }
      },
    )
  })

  it('al aplazar 5 min no vuelve a quedar vencido al instante', async () => {
    const user = userEvent.setup()
    render(
      <ReminderWindow
        initial={{
          title: 'Bocata y tres hermanos',
          timeLabel: '09:25',
          calendarName: 'Calendario de Bruno Sugga',
          description: '',
          eventId,
          kind: 'reminder',
          startsAt: originalStartsAt,
          originalStartsAt,
          reminderMinutes: 0,
        }}
        onDismiss={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: '5 min' }))

    await waitFor(() => {
      const until = Number(localStorage.getItem(`calendario.snooze.${eventId}`))
      expect(until).toBeGreaterThan(Date.now() + 4 * 60 * 1000)
    })

    const fired = JSON.parse(localStorage.getItem('calendario.reminders.fired') ?? '[]') as string[]
    expect(fired).toContain(fireKey)

    const until = Number(localStorage.getItem(`calendario.snooze.${eventId}`))
    expect(
      isOccurrenceDueForReminder(
        {
          eventId,
          calendarId: 'cal-1',
          title: 'Bocata y tres hermanos',
          description: '',
          startsAt: new Date(originalStartsAt),
          endsAt: new Date(originalStartsAt),
          allDay: false,
          reminderMinutes: 0,
          color: '#2F7FD4',
          isRecurring: false,
          originalStartsAt: new Date(originalStartsAt),
          kind: 'reminder',
          taskStatus: null,
        },
        new Date(),
        { snoozeActive: () => until > Date.now() },
      ),
    ).toBe(false)
  })
})
