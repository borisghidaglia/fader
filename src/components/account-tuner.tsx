"use client"

import { ArrowUpRightIcon, BookOpenIcon, LockIcon, RefreshCwIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { saveAccountRatio, syncAccountNow } from "@/app/actions"
import { Fader } from "@/components/fader"
import { AuthorAvatar, TweetCard, VerifiedBadge } from "@/components/tweet/tweet-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { usePoll } from "@/hooks/use-poll"
import { ago, describeRatio, formatCount, formatRate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Account, FeedItem } from "@/lib/types"

/** Give up refreshing after this long; the worker may be paused by a rate limit. */
const SYNC_WAIT_MS = 2 * 60_000

/** One account: its fader, big, over its recent posts, so you can see what each setting lets through. */
export function AccountTuner({
  account,
  tweets,
  defaultRatio,
}: {
  account: Account
  tweets: FeedItem[]
  defaultRatio: number
}) {
  const router = useRouter()
  const [ratio, setRatio] = useState(account.ratio)
  const [syncRequestedAt, setSyncRequestedAt] = useState<number | null>(null)
  const [, startSaving] = useTransition()
  const value = ratio ?? defaultRatio
  const passing = tweets.filter((t) => t.top <= value).length

  // After "Sync now", re-render from the server until the worker has read the account.
  const waitingForSync = syncRequestedAt !== null && (account.lastSyncedAt ?? 0) < syncRequestedAt
  usePoll(
    () => {
      if (syncRequestedAt !== null && Date.now() - syncRequestedAt > SYNC_WAIT_MS) {
        setSyncRequestedAt(null)
        toast("Still waiting for the worker", { description: "The sync light in the menu shows what it's doing." })
        return
      }
      router.refresh()
    },
    4_000,
    { enabled: waitingForSync, immediate: false },
  )

  function save(next: number | null) {
    startSaving(async () => {
      try {
        await saveAccountRatio(account.id, next)
      } catch {
        toast.error(`Couldn't save the fader for @${account.handle}`)
      }
    })
  }

  function reset() {
    setRatio(null)
    save(null)
  }

  async function requestSync() {
    try {
      await syncAccountNow(account.id)
      setSyncRequestedAt(Date.now())
    } catch {
      toast.error(`Couldn't request a sync for @${account.handle}`)
    }
  }

  return (
    <>
      <section aria-label="Profile" className="border-b px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <AuthorAvatar name={account.name} src={account.avatarUrl} className="size-20 sm:size-24" />
          <a
            href={`https://x.com/${account.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Open on X
            <ArrowUpRightIcon aria-hidden />
          </a>
        </div>

        <div className="mt-3 leading-5">
          <p className="flex min-w-0 items-center gap-0.5 text-xl leading-6 font-extrabold">
            <span className="truncate">{account.name}</span>
            {account.verified && <VerifiedBadge className="size-5" />}
            {account.protected && <LockIcon className="size-[18px] shrink-0" role="img" aria-label="Protected account" />}
          </p>
          <p className="text-muted-foreground">@{account.handle}</p>
        </div>

        {account.bio && <p className="mt-3 leading-5 whitespace-pre-line">{account.bio}</p>}

        <p className="mt-3 flex items-center gap-1 text-muted-foreground">
          <BookOpenIcon className="size-[18px]" strokeWidth={1.75} aria-hidden />
          {account.lastSyncedAt === null ? (
            "Not read yet"
          ) : (
            <span suppressHydrationWarning>Read {ago(account.lastSyncedAt)}</span>
          )}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
          <span>
            <span className="readout font-bold text-foreground">{formatCount(account.followersCount)}</span> Followers
          </span>
          {account.lastSyncedAt !== null && (
            <span>
              <span className="readout font-bold text-foreground">{formatRate(account.perDay)}</span> Posts a day
            </span>
          )}
        </p>
        {account.lastError && (
          <p className="mt-2 text-destructive">Last sync failed: {account.lastError}</p>
        )}
      </section>

      <section aria-labelledby="fader-heading" className="border-b px-4 pt-3 pb-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 leading-5">
            <h2 id="fader-heading" className="text-xl leading-6 font-extrabold">
              In your feed
            </h2>
            <p className="text-muted-foreground">
              {ratio === null ? (
                `Using the default, ${describeRatio(defaultRatio).toLowerCase()}`
              ) : (
                <>
                  Set for this account ·{" "}
                  <button type="button" onClick={reset} className="text-signal outline-none hover:underline focus-visible:underline">
                    Use the default
                  </button>
                </>
              )}
            </p>
          </div>
          <p
            className={cn(
              "readout shrink-0 text-[31px] leading-9 font-extrabold tracking-tight",
              ratio === null ? "text-muted-foreground" : value > 0 && "text-signal",
            )}
          >
            {describeRatio(value)}
          </p>
        </div>
        <Fader
          value={value}
          onValueChange={setRatio}
          onValueCommitted={save}
          curve={account.curve}
          label={`Show from @${account.handle}`}
          size="lg"
          className="mt-3"
        />
        <p className="mt-1 flex justify-between text-[13px] text-muted-foreground">
          <span>best</span>
          <span>worst</span>
        </p>
      </section>

      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <p className="text-muted-foreground">
          {tweets.length === 0 ? (
            "No posts read yet"
          ) : (
            <>
              <span className="readout font-bold text-foreground">{passing}</span> of{" "}
              <span className="readout">{tweets.length}</span> recent posts get through
            </>
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={requestSync}
          disabled={waitingForSync || value === 0}
          title={value === 0 ? "Muted accounts aren't synced" : undefined}
        >
          <RefreshCwIcon className={cn(waitingForSync && "animate-spin")} aria-hidden />
          {waitingForSync ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      <ol className="divide-y border-b">
        {tweets.map((tweet) => {
          const through = tweet.top <= value
          return (
            <li
              key={tweet.id}
              className={cn(
                "relative [contain-intrinsic-size:auto_220px] [content-visibility:auto]",
                // Same blue as the lit bars: this one is in your feed.
                through && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-signal",
              )}
            >
              <TweetCard
                item={tweet}
                showRank
                className={cn("transition-opacity duration-150", !through && "opacity-40")}
              />
              {!through && <span className="sr-only">Filtered out by the fader.</span>}
            </li>
          )
        })}
      </ol>
    </>
  )
}
