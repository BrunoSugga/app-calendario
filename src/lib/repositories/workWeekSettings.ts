import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertValidWorkWeekSettings,
  DEFAULT_WORK_WEEK,
  normalizeWorkWeekSettings,
  type WorkWeekSettings,
} from '../../domain/workWeek'
import { loadLocalDb, saveLocalDb } from '../localStore'
import { isCloudMode, supabase } from '../supabase'

export type WorkWeekSettingsRepository = {
  load: () => Promise<WorkWeekSettings>
  save: (settings: WorkWeekSettings) => Promise<WorkWeekSettings>
}

function createLocalWorkWeekSettingsRepository(): WorkWeekSettingsRepository {
  return {
    async load() {
      const db = loadLocalDb()
      if (!db?.workWeek) return { ...DEFAULT_WORK_WEEK }
      return normalizeWorkWeekSettings(db.workWeek)
    },
    async save(settings) {
      assertValidWorkWeekSettings(settings)
      const db = loadLocalDb()
      if (!db) throw new Error('No hay datos locales')
      const next = normalizeWorkWeekSettings(settings)
      // Si el calendario ya no existe, limpiar id
      if (next.workCalendarId && !db.calendars.some((c) => c.id === next.workCalendarId)) {
        next.workCalendarId = null
      }
      saveLocalDb({ ...db, workWeek: next })
      return next
    },
  }
}

function createCloudWorkWeekSettingsRepository(client: SupabaseClient): WorkWeekSettingsRepository {
  return {
    async load() {
      const { data, error } = await client.from('work_week_settings').select('*').maybeSingle()
      if (error) {
        // Migración aún no aplicada: no romper la app
        const message = String(error.message ?? '').toLowerCase()
        if (
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          message.includes('does not exist') ||
          message.includes('schema cache')
        ) {
          return { ...DEFAULT_WORK_WEEK }
        }
        throw new Error(error.message || 'No se pudo cargar la semana laboral')
      }
      if (!data) return { ...DEFAULT_WORK_WEEK }
      return normalizeWorkWeekSettings(data)
    },
    async save(settings) {
      assertValidWorkWeekSettings(settings)
      const next = normalizeWorkWeekSettings(settings)
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser()
      if (userError || !user) throw new Error('Sesión no válida')

      const row = {
        user_id: user.id,
        work_calendar_id: next.workCalendarId,
        work_days: next.workDays,
        start_minute: next.startMinute,
        end_minute: next.endMinute,
        mute_outside_hours: next.muteOutsideHours,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await client
        .from('work_week_settings')
        .upsert(row, { onConflict: 'user_id' })
        .select('*')
        .single()

      if (error) throw new Error(error.message || 'No se pudo guardar la semana laboral')
      return normalizeWorkWeekSettings(data)
    },
  }
}

export function createWorkWeekSettingsRepository(): WorkWeekSettingsRepository {
  if (isCloudMode && supabase) {
    return createCloudWorkWeekSettingsRepository(supabase)
  }
  return createLocalWorkWeekSettingsRepository()
}
