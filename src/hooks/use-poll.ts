"use client"

import { useEffect, useEffectEvent } from "react"

/**
 * Runs `task` every `intervalMs` (and right away unless `immediate` is false), but
 * only while the tab is visible. Coming back to the tab runs it at once.
 */
export function usePoll(
  task: () => Promise<void> | void,
  intervalMs: number,
  { enabled = true, immediate = true }: { enabled?: boolean; immediate?: boolean } = {},
) {
  const run = useEffectEvent(task)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let running = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      // A visibility change can land mid-poll; don't start a second loop.
      if (running) return
      running = true
      clearTimeout(timer)
      if (document.visibilityState === "visible") {
        try {
          await run()
        } catch {
          // A missed poll is harmless; the next one will try again.
        }
      }
      running = false
      if (!cancelled) timer = setTimeout(tick, intervalMs)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void tick()
    }

    if (immediate) void tick()
    else timer = setTimeout(tick, intervalMs)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [intervalMs, enabled, immediate])
}
