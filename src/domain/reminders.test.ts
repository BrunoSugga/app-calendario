import { describe, expect, it } from 'vitest'
import { addDays, addMinutes } from 'date-fns'
import type { Occurrence } from '../types'
import {
  collapseSupersededDueReminders,
  isOccurrenceAncientMissed,
  isOccurrenceDueForReminder,
  partitionMissedReminders,
  reminderFireKey,
  reminderScanRange,
  reminderScanRangeWithWorkWeek,
  reminderSnoozeLookback,
  selectDueReminders,
  shouldCommitReminderLastScan,
} from './reminders'
import { DEFAULT_WORK_WEEK, type WorkWeekSettings } from './workWeek'

function occ(overrides: Partial<Occurrence> = {}): Occurrence {
  const startsAt = overrides.startsAt ?? new Date('2026-08-08T13:17:00.000-03:00')
  return {
    eventId: 'evt-1',
    calendarId: 'cal-1',
    title: 'Prueba',
    description: '',
    startsAt,
    endsAt: overrides.endsAt ?? startsAt,
    allDay: false,
    reminderMinutes: 0,
    color: '#2F7FD4',
    isRecurring: false,
    originalStartsAt: startsAt,
    kind: 'reminder',
    taskStatus: null,
    ...overrides,
  }
}

const workMute: WorkWeekSettings = {
  ...DEFAULT_WORK_WEEK,
  workCalendarId: 'work',
  muteOutsideHours: true,
  workDays: [1, 2, 3, 4, 5],
  startMinute: 8 * 60,
  endMinute: 17 * 60,
}

describe('reminderScanRange', () => {
  it('mira unos minutos atrás para no perder recordatorios de duración 0', () => {
    const now = new Date('2026-08-08T13:17:10.000-03:00')
    const range = reminderScanRange(now, 5, 24)
    expect(range.start.getTime()).toBe(addMinutes(now, -5).getTime())
    expect(range.end.getTime()).toBe(addMinutes(now, 24 * 60).getTime())
  })

  it('con mute laboral amplía el lookback hasta el fin de jornada previa', () => {
    const now = new Date('2026-08-10T08:30:00') // lunes
    const range = reminderScanRangeWithWorkWeek(now, workMute)
    expect(range.start.getDate()).toBe(7) // viernes
    expect(range.start.getHours()).toBe(17)
  })

  it('con lastScan amplía el lookback del scan', () => {
    const now = new Date('2026-08-20T10:00:00.000-03:00')
    const lastScan = new Date('2026-07-20T10:00:00.000-03:00')
    const range = reminderScanRangeWithWorkWeek(now, null, 5, 24, lastScan)
    expect(range.start.getTime()).toBe(lastScan.getTime())
  })

  it('conserva en el scan la ocurrencia original mientras hay un snooze relevante', () => {
    const now = new Date('2026-08-08T19:17:10.000-03:00')
    const snoozedUntil = new Date('2026-08-08T19:17:00.000-03:00')
    const lookback = reminderSnoozeLookback([snoozedUntil.getTime()], now)

    expect(lookback?.getTime()).toBe(
      new Date('2026-08-08T07:17:00.000-03:00').getTime(),
    )
  })
})

describe('catch-up al reabrir', () => {
  it('aviso de hace horas con lastScan previo entra en due (popup)', () => {
    const now = new Date('2026-08-20T18:00:00.000-03:00')
    const startsAt = new Date('2026-08-20T10:00:00.000-03:00')
    const lastScan = new Date('2026-08-19T18:00:00.000-03:00')
    expect(
      isOccurrenceDueForReminder(occ({ startsAt, endsAt: startsAt, reminderMinutes: 0 }), now, {
        lastScan,
      }),
    ).toBe(true)
  })

  it('aviso de hace 20 días con lastScan 30 días atrás va a ancient, no a due', () => {
    const now = new Date('2026-08-20T12:00:00.000-03:00')
    const startsAt = addDays(now, -20)
    const lastScan = addDays(now, -30)
    const item = occ({
      eventId: 'evt-old',
      startsAt,
      endsAt: startsAt,
      originalStartsAt: startsAt,
      reminderMinutes: 0,
    })
    expect(isOccurrenceDueForReminder(item, now, { lastScan })).toBe(false)
    expect(isOccurrenceAncientMissed(item, now, { lastScan })).toBe(true)
    const { due, ancient } = partitionMissedReminders([item], now, new Set(), { lastScan })
    expect(due).toHaveLength(0)
    expect(ancient.map((o) => o.eventId)).toEqual(['evt-old'])
  })

  it('sin lastScan no inventa catch-up ni ancient', () => {
    const now = new Date('2026-08-20T12:00:00.000-03:00')
    const startsAt = addDays(now, -3)
    const item = occ({ startsAt, endsAt: startsAt, originalStartsAt: startsAt, reminderMinutes: 0 })
    expect(isOccurrenceDueForReminder(item, now)).toBe(false)
    expect(isOccurrenceAncientMissed(item, now)).toBe(false)
    expect(partitionMissedReminders([item], now, new Set())).toEqual({ due: [], ancient: [] })
  })

  it('anterior a lastScan no aparece', () => {
    const now = new Date('2026-08-20T12:00:00.000-03:00')
    const lastScan = addDays(now, -10)
    const startsAt = addDays(now, -12)
    const item = occ({ startsAt, endsAt: startsAt, originalStartsAt: startsAt, reminderMinutes: 0 })
    const parts = partitionMissedReminders([item], now, new Set(), { lastScan })
    expect(parts).toEqual({ due: [], ancient: [] })
  })

  it('ya en fired no vuelve ni como due ni ancient', () => {
    const now = new Date('2026-08-20T12:00:00.000-03:00')
    const lastScan = addDays(now, -30)
    const recentAt = addMinutes(now, -3 * 60)
    const recent = occ({
      eventId: 'evt-recent',
      startsAt: recentAt,
      endsAt: recentAt,
      originalStartsAt: recentAt,
      reminderMinutes: 0,
    })
    const ancientAt = addDays(now, -20)
    const old = occ({
      eventId: 'evt-ancient',
      startsAt: ancientAt,
      endsAt: ancientAt,
      originalStartsAt: ancientAt,
      reminderMinutes: 0,
    })
    const fired = new Set([
      reminderFireKey(recent.eventId, recent.originalStartsAt),
      reminderFireKey(old.eventId, old.originalStartsAt),
    ])
    expect(partitionMissedReminders([recent, old], now, fired, { lastScan })).toEqual({
      due: [],
      ancient: [],
    })
  })

  it('si lastScan se adelanta a now (tick vacío) el catch-up se pierde', () => {
    // Regresión: useReminders no debe saveLastScan antes de loading=false.
    const now = new Date('2026-08-20T18:00:00.000-03:00')
    const startsAt = new Date('2026-08-20T10:00:00.000-03:00')
    const lastScanBeforeClose = new Date('2026-08-19T18:00:00.000-03:00')
    const item = occ({ startsAt, endsAt: startsAt, originalStartsAt: startsAt, reminderMinutes: 0 })
    expect(partitionMissedReminders([item], now, new Set(), { lastScan: lastScanBeforeClose }).due).toHaveLength(
      1,
    )
    expect(partitionMissedReminders([item], now, new Set(), { lastScan: now }).due).toHaveLength(0)
  })
})

describe('shouldCommitReminderLastScan', () => {
  it('exige datos listos, sin modal pendiente y sin fallos al abrir', () => {
    expect(
      shouldCommitReminderLastScan({ dataReady: true, missedModalPending: false, openFailures: 0 }),
    ).toBe(true)
    expect(
      shouldCommitReminderLastScan({ dataReady: false, missedModalPending: false, openFailures: 0 }),
    ).toBe(false)
    expect(
      shouldCommitReminderLastScan({ dataReady: true, missedModalPending: true, openFailures: 0 }),
    ).toBe(false)
    expect(
      shouldCommitReminderLastScan({ dataReady: true, missedModalPending: false, openFailures: 1 }),
    ).toBe(false)
  })
})
describe('isOccurrenceDueForReminder', () => {
  it('dispara al inicio (aviso 0) dentro de la gracia', () => {
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const now = new Date('2026-08-08T13:17:20.000-03:00')
    expect(
      isOccurrenceDueForReminder(occ({ startsAt, endsAt: startsAt, reminderMinutes: 0 }), now),
    ).toBe(true)
  })

  it('no dispara si ya pasó la gracia', () => {
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const now = new Date('2026-08-08T13:23:00.000-03:00')
    expect(
      isOccurrenceDueForReminder(occ({ startsAt, endsAt: startsAt, reminderMinutes: 0 }), now),
    ).toBe(false)
  })

  it('dispara N minutos antes', () => {
    const startsAt = new Date('2026-08-08T14:00:00.000-03:00')
    const now = new Date('2026-08-08T13:45:00.000-03:00')
    expect(isOccurrenceDueForReminder(occ({ startsAt, reminderMinutes: 15 }), now)).toBe(true)
    expect(
      isOccurrenceDueForReminder(
        occ({ startsAt, reminderMinutes: 15 }),
        new Date('2026-08-08T13:44:00.000-03:00'),
      ),
    ).toBe(false)
  })

  it('respeta snooze activo', () => {
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const now = new Date('2026-08-08T13:17:10.000-03:00')
    expect(
      isOccurrenceDueForReminder(occ({ startsAt, reminderMinutes: 0 }), now, {
        snoozeActive: () => true,
      }),
    ).toBe(false)
  })

  it('vuelve a disparar al vencer el snooze aunque lastScan haya avanzado', () => {
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const snoozedUntil = new Date('2026-08-08T13:22:00.000-03:00')
    const lastScan = new Date('2026-08-08T13:21:55.000-03:00')
    const now = new Date('2026-08-08T13:22:10.000-03:00')

    expect(
      isOccurrenceDueForReminder(occ({ startsAt, reminderMinutes: 0 }), now, {
        lastScan,
        snoozeUntil: () => snoozedUntil.getTime(),
      }),
    ).toBe(true)
  })
})

describe('semana laboral / mute', () => {
  it('calendario personal sigue con gracia 5 min aunque mute esté activo', () => {
    const startsAt = new Date('2026-08-07T22:00:00') // viernes noche
    const now = new Date('2026-08-10T08:30:00') // lunes mañana
    expect(
      isOccurrenceDueForReminder(
        occ({ calendarId: 'personal', startsAt, endsAt: startsAt, reminderMinutes: 0 }),
        now,
        { workWeek: workMute },
      ),
    ).toBe(false)
  })

  it('hold: no dispara laboral fuera de jornada', () => {
    const startsAt = new Date('2026-08-07T22:00:00')
    const now = new Date('2026-08-07T22:00:30')
    expect(
      isOccurrenceDueForReminder(
        occ({ calendarId: 'work', startsAt, endsAt: startsAt, reminderMinutes: 0 }),
        now,
        { workWeek: workMute },
      ),
    ).toBe(false)
  })

  it('flush: dispara laboral diferido al entrar a jornada (vie 22:00 → lun 08:30)', () => {
    const startsAt = new Date('2026-08-07T22:00:00')
    const now = new Date('2026-08-10T08:30:00')
    expect(
      isOccurrenceDueForReminder(
        occ({ calendarId: 'work', startsAt, endsAt: startsAt, reminderMinutes: 0 }),
        now,
        { workWeek: workMute },
      ),
    ).toBe(true)
  })

  it('mute off: laboral usa gracia normal (no sobrevive el finde)', () => {
    const startsAt = new Date('2026-08-07T22:00:00')
    const now = new Date('2026-08-10T08:30:00')
    expect(
      isOccurrenceDueForReminder(
        occ({ calendarId: 'work', startsAt, endsAt: startsAt, reminderMinutes: 0 }),
        now,
        { workWeek: { ...workMute, muteOutsideHours: false } },
      ),
    ).toBe(false)
  })

  it('respeta snooze y fired en flush laboral', () => {
    const startsAt = new Date('2026-08-07T22:00:00')
    const now = new Date('2026-08-10T08:30:00')
    const item = occ({
      eventId: 'evt-work',
      calendarId: 'work',
      startsAt,
      endsAt: startsAt,
      reminderMinutes: 0,
      originalStartsAt: startsAt,
    })
    expect(
      isOccurrenceDueForReminder(item, now, {
        workWeek: workMute,
        snoozeActive: () => true,
      }),
    ).toBe(false)
    const fired = new Set([reminderFireKey(item.eventId, item.originalStartsAt)])
    expect(selectDueReminders([item], now, fired, { workWeek: workMute })).toEqual([])
    expect(
      selectDueReminders([item], now, new Set(), { workWeek: workMute }).map((o) => o.eventId),
    ).toEqual(['evt-work'])
  })
})

describe('selectDueReminders', () => {
  it('omite keys ya disparadas', () => {
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const item = occ({ startsAt, endsAt: startsAt, reminderMinutes: 0 })
    const now = new Date('2026-08-08T13:17:10.000-03:00')
    const fired = new Set([reminderFireKey(item.eventId, item.originalStartsAt)])
    expect(selectDueReminders([item], now, fired)).toEqual([])
    expect(selectDueReminders([item], now, new Set()).map((o) => o.eventId)).toEqual(['evt-1'])
  })
})

describe('pipeline expand + due (regresión recordatorio duración 0)', () => {
  it('el rango de scan incluye un reminder que empezó hace segundos', async () => {
    const { expandOccurrences } = await import('./recurrence')
    const startsAt = new Date('2026-08-08T13:17:00.000-03:00')
    const now = new Date('2026-08-08T13:17:10.000-03:00')
    const range = reminderScanRange(now)

    const events = [
      {
        id: 'evt-1',
        user_id: 'u1',
        calendar_id: 'cal-1',
        title: 'Prueba',
        description: '',
        starts_at: startsAt.toISOString(),
        ends_at: startsAt.toISOString(),
        all_day: false,
        reminder_minutes: 0,
        rrule: null,
        kind: 'reminder' as const,
        task_status: null,
        task_started_at: null,
        task_completed_at: null,
        task_duration_ms: null,
        task_note: null,
        created_at: startsAt.toISOString(),
        updated_at: startsAt.toISOString(),
      },
    ]
    const calendars = [
      {
        id: 'cal-1',
        user_id: 'u1',
        name: 'Personal',
        color: '#2F7FD4',
        is_default: true,
        visible: true,
        created_at: startsAt.toISOString(),
      },
    ]

    // Bug viejo: rangeStart=now excluía ends_at < now
    const broken = expandOccurrences(events, calendars, [], now, range.end)
    expect(broken).toHaveLength(0)

    const fixed = expandOccurrences(events, calendars, [], range.start, range.end)
    expect(fixed).toHaveLength(1)
    expect(selectDueReminders(fixed, now, new Set()).map((o) => o.eventId)).toEqual(['evt-1'])
  })
})

describe('collapseSupersededDueReminders', () => {
  it('de una serie solo avisa la repetición vencida más reciente', () => {
    const monday = new Date('2026-09-28T12:00:00.000Z')
    const tuesday = new Date('2026-09-29T12:00:00.000Z')
    const wednesday = new Date('2026-09-30T12:00:00.000Z')
    const series = [monday, tuesday, wednesday].map((startsAt) =>
      occ({
        eventId: 'daily-1',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        originalStartsAt: startsAt,
        isRecurring: true,
        kind: 'event',
      }),
    )
    const other = occ({
      eventId: 'once-1',
      startsAt: tuesday,
      endsAt: new Date(tuesday.getTime() + 30 * 60 * 1000),
      originalStartsAt: tuesday,
      kind: 'event',
    })

    const { notify, acknowledge } = collapseSupersededDueReminders([...series, other])
    expect(notify.map((item) => item.eventId + item.startsAt.toISOString())).toEqual([
      `once-1${tuesday.toISOString()}`,
      `daily-1${wednesday.toISOString()}`,
    ])
    expect(acknowledge.map((item) => item.startsAt.toISOString())).toEqual([
      monday.toISOString(),
      tuesday.toISOString(),
    ])
  })

  it('un evento suelto sigue avisando', () => {
    const item = occ({ kind: 'event', isRecurring: false })
    expect(collapseSupersededDueReminders([item])).toEqual({ notify: [item], acknowledge: [] })
  })
})
