"use client"

import { RefreshCwIcon } from "lucide-react"
import { createContext, use, useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { syncNow } from "@/app/actions"
import type { StatusResponse } from "@/app/api/status/route"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { usePoll } from "@/hooks/use-poll"
import { ago } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { SyncStatus as Status } from "@/lib/types"

/** The worker heartbeats every 10s; this much silence means it isn't running. */
const OFFLINE_AFTER_MS = 45_000
const POLL_MS = 5_000

type Tone = "live" | "busy" | "paused" | "error" | "off"

type View = { tone: Tone; label: string; title: string; detail: ReactNode }

/** A status reading, with the time it was taken. */
type Reading = Status & { readAt: number }

const StatusContext = createContext<{ status: Reading | null; refresh: () => Promise<void> }>({
  status: null,
  refresh: async () => {},
})

/** Polls the sync status once for every status light on the page. */
export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Reading | null>(null)

  async function refresh() {
    const response = await fetch("/api/status", { cache: "no-store" })
    if (!response.ok) return
    const body = (await response.json()) as StatusResponse
    setStatus({ ...body, readAt: Date.now() })
  }
  usePoll(refresh, POLL_MS)

  return <StatusContext value={{ status, refresh }}>{children}</StatusContext>
}

/**
 * The sync status: in the side column where X shows your account ("rail"), or as
 * a tab in the phone navigation bar ("tab"). Opens the details and "Sync now".
 */
export function SyncStatus({ variant, className }: { variant: "rail" | "tab"; className?: string }) {
  const { status, refresh } = use(StatusContext)
  const [requesting, startRequest] = useTransition()
  const view = status ? describe(status, status.readAt) : null
  const progress =
    status && status.accountsTotal > 0 ? `${status.accountsSynced} of ${status.accountsTotal} accounts read` : null

  function requestSync() {
    startRequest(async () => {
      try {
        await syncNow()
        toast("Sync requested", { description: "The worker picks it up within a few seconds." })
        await refresh()
      } catch {
        toast.error("Couldn't request a sync")
      }
    })
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "group flex items-center outline-none",
          variant === "rail" ? "rounded-full p-3 transition-colors hover:bg-hover data-popup-open:bg-hover xl:w-full" : "justify-center",
          "focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        aria-label={view ? `Sync status: ${view.title}` : "Sync status"}
      >
        <span className="flex size-[26px] shrink-0 items-center justify-center">
          <Led tone={view?.tone ?? "off"} size="lg" />
        </span>
        {variant === "rail" && (
          <span className="ml-3 hidden min-w-0 text-left leading-5 xl:block">
            <span className="block truncate font-bold">{view?.label ?? "Checking…"}</span>
            {progress && <span className="block truncate text-muted-foreground">{progress}</span>}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align={variant === "rail" ? "start" : "end"}
        sideOffset={8}
        className="w-80 gap-3 rounded-2xl p-4 text-[15px]"
      >
        {status && view ? (
          <>
            <div className="flex items-start gap-3">
              <Led tone={view.tone} className="mt-1.5" />
              <div className="min-w-0">
                <p className="font-bold">{view.title}</p>
                {view.detail && <p className="mt-0.5 text-muted-foreground">{view.detail}</p>}
              </div>
            </div>

            <dl className="readout grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t pt-3 text-[13px]">
              <dt className="text-muted-foreground">New posts checked</dt>
              <dd className="text-right">{status.lastFeedSyncAt ? ago(status.lastFeedSyncAt, status.readAt) : "never"}</dd>
              <dt className="text-muted-foreground">Accounts read</dt>
              <dd className="text-right">
                {status.accountsTotal > 0 ? `${status.accountsSynced} of ${status.accountsTotal}` : "—"}
              </dd>
              <dt className="text-muted-foreground">Following list</dt>
              <dd className="text-right">{status.lastFollowingSyncAt ? ago(status.lastFollowingSyncAt, status.readAt) : "never"}</dd>
            </dl>

            <Button
              variant="outline"
              size="sm"
              onClick={requestSync}
              disabled={requesting || view.tone === "off"}
              className="self-start"
            >
              <RefreshCwIcon className={cn(requesting && "animate-spin")} aria-hidden />
              Sync now
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">Checking sync status…</p>
        )}
      </PopoverContent>
    </Popover>
  )
}

function describe(status: Status, now: number): View {
  if (now - status.heartbeatAt > OFFLINE_AFTER_MS) {
    return {
      tone: "off",
      label: "Sync off",
      title: "The sync worker isn't running",
      detail: (
        <>
          Start it with <code className="text-[13px] text-foreground">pnpm dev</code>, which runs the app and the
          worker together, or <code className="text-[13px] text-foreground">pnpm worker</code> on its own.
        </>
      ),
    }
  }

  // One step failing while the others carry on.
  if (status.state !== "error" && status.error) {
    return {
      tone: "error",
      label: "Sync error",
      title: "Part of the sync is failing",
      detail: (
        <>
          {status.error}
          <span className="mt-1.5 block">Everything else keeps syncing, and this is retried on its own.</span>
        </>
      ),
    }
  }

  switch (status.state) {
    case "error":
      return { tone: "error", label: "Sync error", title: "Sync stopped", detail: status.error ?? status.message }
    case "syncing": {
      const { accountsSynced: synced, accountsTotal: total } = status
      return {
        tone: "busy",
        label: total > 0 && synced < total ? `Syncing ${synced}/${total}` : "Syncing",
        title: "Syncing",
        detail: status.message,
      }
    }
    default:
      if (status.rateLimitedUntil && status.rateLimitedUntil > now) {
        const until = new Date(status.rateLimitedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        return {
          tone: "paused",
          label: `Next read ${until}`,
          title: `Next read at ${until}`,
          detail:
            "Fader reads X slowly on purpose, a small fraction of what X allows, so your account's activity looks like normal browsing. It carries on by itself.",
        }
      }
      return {
        tone: "live",
        label: status.lastFeedSyncAt ? `Synced ${ago(status.lastFeedSyncAt, now)}` : "Up to date",
        title: "Up to date",
        detail: "New posts are checked every few minutes; each account is re-read on its own schedule.",
      }
  }
}

/** A status light. */
function Led({ tone, size = "sm", className }: { tone: Tone; size?: "sm" | "lg"; className?: string }) {
  return (
    <span className={cn("relative flex shrink-0", size === "lg" ? "size-3" : "size-2", className)} aria-hidden>
      {tone === "busy" && (
        <span className="absolute inset-0 animate-ping rounded-full bg-signal opacity-60 motion-reduce:hidden" />
      )}
      <span
        className={cn(
          "relative size-full rounded-full",
          tone === "live" && "bg-signal",
          tone === "busy" && "bg-signal",
          tone === "paused" && "border-2 border-signal",
          tone === "error" && "bg-destructive",
          tone === "off" && "border-2 border-foreground/30",
        )}
      />
    </span>
  )
}
