import type { SupabaseClient } from '@supabase/supabase-js'
import type { Calendar, CalendarEvent, EventDraft, EventException } from '../../types'
import { sanitizeCalendarName, sanitizeColor, sanitizeEventDraft } from '../security'
import type { CalendarRepository, CalendarSnapshot } from './types'

export function createCloudCalendarRepository(client: SupabaseClient): CalendarRepository {
  const load = async (): Promise<CalendarSnapshot> => {
    const [cRes, eRes, xRes] = await Promise.all([
      client.from('calendars').select('*').order('created_at'),
      client.from('events').select('*').order('starts_at'),
      client.from('event_exceptions').select('*'),
    ])
    if (cRes.error) throw cRes.error
    if (eRes.error) throw eRes.error
    if (xRes.error) throw xRes.error
    return {
      calendars: (cRes.data ?? []) as Calendar[],
      events: (eRes.data ?? []) as CalendarEvent[],
      exceptions: (xRes.data ?? []) as EventException[],
    }
  }

  return {
    load,

    async toggleCalendarVisible(state, id) {
      const calendar = state.calendars.find((c) => c.id === id)
      if (!calendar) return state
      const { error } = await client
        .from('calendars')
        .update({ visible: !calendar.visible })
        .eq('id', id)
      if (error) throw error
      return load()
    },

    async setDefaultCalendar(_state, id, userId) {
      await client.from('calendars').update({ is_default: false }).eq('user_id', userId)
      const { error } = await client.from('calendars').update({ is_default: true }).eq('id', id)
      if (error) throw error
      return load()
    },

    async createCalendar(_state, userId, name, color) {
      const { error } = await client.from('calendars').insert({
        user_id: userId,
        name: sanitizeCalendarName(name),
        color: sanitizeColor(color),
        is_default: false,
        visible: true,
      })
      if (error) throw error
      return load()
    },

    async saveEvent(_state, userId, draft: EventDraft) {
      draft = sanitizeEventDraft(draft)
      if (draft.id && draft.editScope === 'single' && draft.occurrenceOriginalStartsAt) {
        const row = {
          event_id: draft.id,
          user_id: userId,
          original_starts_at: draft.occurrenceOriginalStartsAt,
          is_cancelled: false,
          title: draft.title,
          description: draft.description,
          starts_at: draft.starts_at,
          ends_at: draft.ends_at,
          all_day: draft.all_day,
          reminder_minutes: draft.reminder_minutes,
        }
        const { error } = await client
          .from('event_exceptions')
          .upsert(row, { onConflict: 'event_id,original_starts_at' })
        if (error) {
          const { error: insertErr } = await client.from('event_exceptions').insert(row)
          if (insertErr) throw insertErr
        }
        return load()
      }

      const payload = {
        calendar_id: draft.calendar_id,
        title: draft.title,
        description: draft.description,
        starts_at: draft.starts_at,
        ends_at: draft.ends_at,
        all_day: draft.all_day,
        reminder_minutes: draft.reminder_minutes,
        rrule: draft.rrule,
        updated_at: new Date().toISOString(),
      }

      if (draft.id) {
        const { error } = await client.from('events').update(payload).eq('id', draft.id)
        if (error) throw error
      } else {
        const { error } = await client.from('events').insert({
          ...payload,
          user_id: userId,
        })
        if (error) throw error
      }
      return load()
    },

    async deleteEvent(_state, userId, eventId, scope, originalStartsAt) {
      if (scope === 'single' && originalStartsAt) {
        const { error } = await client.from('event_exceptions').upsert(
          {
            event_id: eventId,
            user_id: userId,
            original_starts_at: originalStartsAt,
            is_cancelled: true,
            title: null,
            description: null,
            starts_at: null,
            ends_at: null,
            all_day: null,
            reminder_minutes: null,
          },
          { onConflict: 'event_id,original_starts_at' },
        )
        if (error) throw error
        return load()
      }

      const { error } = await client.from('events').delete().eq('id', eventId)
      if (error) throw error
      return load()
    },

    subscribe(onChange) {
      const channel = client
        .channel('calendar-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calendars' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, onChange)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'event_exceptions' },
          onChange,
        )
        .subscribe()

      return () => {
        void client.removeChannel(channel)
      }
    },
  }
}
