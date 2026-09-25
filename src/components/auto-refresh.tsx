"use client"

import { useRouter } from "next/navigation"

import { usePoll } from "@/hooks/use-poll"

/** Re-renders the page from the server every so often, while it waits for data. */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter()
  usePoll(() => router.refresh(), intervalMs, { immediate: false })
  return null
}
