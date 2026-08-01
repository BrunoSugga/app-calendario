import { isCloudMode, supabase } from '../supabase'
import { createCloudCalendarRepository } from './cloudCalendarRepository'
import { createLocalCalendarRepository } from './localCalendarRepository'
import type { CalendarRepository } from './types'

export type { CalendarRepository, CalendarSnapshot } from './types'
export { emptySnapshot } from './types'
export { createLocalCalendarRepository } from './localCalendarRepository'
export { createCloudCalendarRepository } from './cloudCalendarRepository'

export function createCalendarRepository(): CalendarRepository {
  if (isCloudMode && supabase) {
    return createCloudCalendarRepository(supabase)
  }
  return createLocalCalendarRepository()
}
