import { useEffect, useRef, useState } from 'react'
import {
  isSupersededInProgressTask,
  isTaskEndDue,
  selectDueTaskEndPrompts,
  taskEndCheckpoint,
  taskEndExtensionDraft,
  taskEndPromptKey,
  type TaskEndCheckpoint,
} from '../domain/taskEndPrompt'
import { useAuth } from '../context/AuthContext'
import { useCalendarData } from '../context/CalendarDataContext'
import { isCapacitor } from '../lib/platform'
import { isSafeId } from '../lib/security'
import {
  consumeQueuedCompleteTask,
  consumeQueuedExtendTaskEnd,
  consumeQueuedTaskEndClosed,
  isTauri,
  openTaskEndPromptWindow,
} from '../lib/tauri'

type Options = {
  onError?: (message: string) => void
}

export function useTaskEndPrompts(options: Options = {}): {
  fallbackPrompt: TaskEndCheckpoint | null
  confirmFinished: (eventId: string) => void
  extendOneHour: (eventId: string) => void
} {
  const { user } = useAuth()
  const { events, calendars, exceptions, loading, completeTask, saveEvent } = useCalendarData()
  const promptedRef = useRef(new Set<string>())
  const closingRef = useRef(new Set<string>())
  const activeKeyRef = useRef<string | null>(null)
  const inflightRef = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const dataRef = useRef({ events, calendars, exceptions, completeTask, saveEvent })
  dataRef.current = { events, calendars, exceptions, completeTask, saveEvent }
  const [fallbackPrompt, setFallbackPrompt] = useState<TaskEndCheckpoint | null>(null)

  async function apply(action: 'complete' | 'extend', eventId: string) {
    if (!isSafeId(eventId) || inflightRef.current) return
    inflightRef.current = true
    const key = activeKeyRef.current
    activeKeyRef.current = null
    setFallbackPrompt(null)
    try {
      const { events: currentEvents, calendars: currentCalendars, exceptions: currentExceptions } =
        dataRef.current
      const event = currentEvents.find((item) => item.id === eventId)
      if (!event || event.kind !== 'task' || event.task_status !== 'in_progress') return
      if (action === 'complete') {
        await dataRef.current.completeTask(eventId)
        return
      }
      const now = new Date()
      const checkpoint = taskEndCheckpoint(event, currentCalendars, currentExceptions, now)
      if (!checkpoint) return
      await dataRef.current.saveEvent(taskEndExtensionDraft(event, checkpoint, now))
    } catch (err) {
      if (key) promptedRef.current.delete(key)
      const message = err instanceof Error ? err.message : 'No se pudo actualizar la tarea'
      optionsRef.current.onError?.(message)
    } finally {
      inflightRef.current = false
    }
  }

  function confirmFinished(eventId: string) {
    void apply('complete', eventId)
  }

  function extendOneHour(eventId: string) {
    void apply('extend', eventId)
  }

  function showFallbackFor(eventId: string) {
    if (!isSafeId(eventId)) return
    const { events: currentEvents, calendars: currentCalendars, exceptions: currentExceptions } =
      dataRef.current
    const event = currentEvents.find((item) => item.id === eventId)
    if (!event) return
    const now = new Date()
    const checkpoint = taskEndCheckpoint(event, currentCalendars, currentExceptions, now)
    if (!checkpoint || !isTaskEndDue(checkpoint, now)) return
    setFallbackPrompt(checkpoint)
  }

  useEffect(() => {
    function handleComplete(eventId: string) {
      confirmFinished(eventId)
    }
    function handleExtend(eventId: string) {
      extendOneHour(eventId)
    }
    function onDomComplete(ev: Event) {
      const detail = (ev as CustomEvent<{ eventId: string }>).detail
      if (detail?.eventId) handleComplete(detail.eventId)
    }
    function onDomExtend(ev: Event) {
      const detail = (ev as CustomEvent<{ eventId: string }>).detail
      if (detail?.eventId) handleExtend(detail.eventId)
    }

    window.addEventListener('calendario:complete-task', onDomComplete)
    window.addEventListener('calendario:extend-task-end', onDomExtend)

    let unlistenComplete: (() => void) | undefined
    let unlistenExtend: (() => void) | undefined
    let cancelled = false

    if (isTauri()) {
      void (async () => {
        const { listen } = await import('@tauri-apps/api/event')
        if (cancelled) return
        unlistenComplete = await listen<{ eventId: string }>('calendario:complete-task', (event) => {
          handleComplete(event.payload.eventId)
        })
        unlistenExtend = await listen<{ eventId: string }>('calendario:extend-task-end', (event) => {
          handleExtend(event.payload.eventId)
        })
      })()
    }

    const pollPending = () => {
      const completeId = consumeQueuedCompleteTask()
      if (completeId) handleComplete(completeId)
      const extendId = consumeQueuedExtendTaskEnd()
      if (extendId) handleExtend(extendId)
      const closedId = consumeQueuedTaskEndClosed()
      if (closedId) showFallbackFor(closedId)
    }
    pollPending()
    const pendingId = window.setInterval(pollPending, 2000)

    return () => {
      cancelled = true
      window.removeEventListener('calendario:complete-task', onDomComplete)
      window.removeEventListener('calendario:extend-task-end', onDomExtend)
      window.clearInterval(pendingId)
      unlistenComplete?.()
      unlistenExtend?.()
    }
  }, [])

  useEffect(() => {
    if (!user || loading) return
    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      const now = new Date()
      const { events: currentEvents, calendars: currentCalendars, exceptions: currentExceptions } =
        dataRef.current
      for (const id of closingRef.current) {
        const event = currentEvents.find((item) => item.id === id)
        if (!event || event.task_status !== 'in_progress') closingRef.current.delete(id)
      }
      for (const event of currentEvents) {
        if (!isSupersededInProgressTask(event, currentCalendars, currentExceptions, now)) continue
        if (closingRef.current.has(event.id) || inflightRef.current) continue
        closingRef.current.add(event.id)
        void dataRef.current.completeTask(event.id).catch(() => {
          closingRef.current.delete(event.id)
        })
      }
      if (activeKeyRef.current || inflightRef.current) return
      const due = selectDueTaskEndPrompts(
        currentEvents,
        currentCalendars,
        currentExceptions,
        now,
        promptedRef.current,
      )
      const next = due[0]
      if (!next) return
      const key = taskEndPromptKey(next.eventId, next.endsAt)
      promptedRef.current.add(key)
      activeKeyRef.current = key

      if (isCapacitor()) {
        setFallbackPrompt(next)
        return
      }

      const opened = await openTaskEndPromptWindow({
        eventId: next.eventId,
        title: next.title,
        endsAt: next.endsAt.toISOString(),
      })
      if (cancelled) {
        if (!opened) {
          promptedRef.current.delete(key)
          if (activeKeyRef.current === key) activeKeyRef.current = null
        }
        return
      }
      if (!opened) setFallbackPrompt(next)
    }

    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 15000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [user, loading, events, calendars, exceptions])

  return { fallbackPrompt, confirmFinished, extendOneHour }
}
