import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import { isCapacitor } from './platform'
import {
  parseNotificationExtra,
  persistFiredKey,
  scheduleFromOccurrences,
  type NativeReminderExtra,
  type ScheduleFromOccurrencesOptions,
} from './nativeReminders'
import { reminderFireKey } from '../domain/reminders'
import type { Occurrence } from '../types'

const CHANNEL_ID = 'calendario-reminders'

export async function requestNativeReminderPermissions(): Promise<boolean> {
  if (!isCapacitor()) return false
  const current = await LocalNotifications.checkPermissions()
  const display =
    current.display === 'granted'
      ? current
      : await LocalNotifications.requestPermissions()
  if (display.display !== 'granted') return false
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Recordatorios',
      description: 'Avisos del calendario BMatrix',
      importance: 5,
      visibility: 0,
      sound: 'default',
    })
  } catch {
    // iOS / canales ya existentes
  }
  try {
    if (typeof LocalNotifications.changeExactNotificationSetting === 'function') {
      await LocalNotifications.changeExactNotificationSetting()
    }
  } catch {
    // opt-in; el usuario puede denegar
  }
  return true
}

function toSchema(item: ReturnType<typeof scheduleFromOccurrences>[number]): LocalNotificationSchema {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    schedule: { at: item.at, allowWhileIdle: true },
    extra: item.extra,
    channelId: CHANNEL_ID,
  }
}

export async function syncNativeReminderSchedule(
  occurrences: Occurrence[],
  options: ScheduleFromOccurrencesOptions,
): Promise<number> {
  if (!isCapacitor()) return 0
  const items = scheduleFromOccurrences(occurrences, options)
  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      })
    }
  } catch {
    // ignore
  }
  if (items.length === 0) return 0
  await LocalNotifications.schedule({
    notifications: items.map(toSchema),
  })
  return items.length
}

function dispatchInAppReminder(extra: NativeReminderExtra): void {
  persistFiredKey(reminderFireKey(extra.eventId, new Date(extra.originalStartsAt)))
  window.dispatchEvent(
    new CustomEvent('calendario:show-reminder', {
      detail: {
        payload: {
          title: extra.title,
          timeLabel: extra.timeLabel,
          calendarName: extra.calendarName,
          description: '',
          eventId: extra.eventId,
          kind: extra.kind,
          startsAt: extra.startsAt,
          originalStartsAt: extra.originalStartsAt,
        },
      },
    }),
  )
}

export async function listenNativeReminderActions(): Promise<() => void> {
  if (!isCapacitor()) return () => undefined

  const received = await LocalNotifications.addListener('localNotificationReceived', (notification) => {
    const extra = parseNotificationExtra(notification.extra)
    if (!extra) return
    dispatchInAppReminder(extra)
  })

  const performed = await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      const extra = parseNotificationExtra(event.notification.extra)
      if (!extra) return
      dispatchInAppReminder(extra)
    },
  )

  return () => {
    void received.remove()
    void performed.remove()
  }
}
