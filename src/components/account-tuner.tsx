"use client"

import { ArrowUpRightIcon, BookOpenIcon, LockIcon, RefreshCwIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"

import { saveAccountFaders, splitAccountFaders, syncAccountNow } from "@/app/actions"
import { Fader } from "@/components/fader"
import { AuthorAvatar, TweetCard, VerifiedBadge } from "@/components/tweet/tweet-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { usePoll } from "@/hooks/use-poll"
import type { Bar } from "@/lib/curve"
import { getsThrough, isMuted, isTuned, levels, type Faders } from "@/lib/faders"
import { ago, describeRatio, formatCount, formatPerDay, formatRate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Account, FeedItem } from "@/lib/types"

/** Give up refreshing after this long; the worker may be paused by a rate limit. */
const SYNC_WAIT_MS = 2 * 60_000

/**
 * One account: its fader, big, over its recent posts, so you can see what each setting
 * lets through. Its replies can get a fader of their own.
 */
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
  const [faders, setFaders] = useState<Faders>({ ratio: account.ratio, replyRatio: account.replyRatio })
  const [syncRequestedAt, setSyncRequestedAt] = useState<number | null>(null)
  const [, startSaving] = useTransition()
  const splitId = useId()
  const { split, posts, replies } = levels(faders, defaultRatio)
  const muted = isMuted(faders, defaultRatio)
  const passing = tweets.filter((t) => getsThrough(t, faders, defaultRatio)).length

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

  /** Saves only the faders that moved, so a stale tab can't undo the other. */
  function save(changes: Partial<Faders>) {
    startSaving(async () => {
      try {
        await saveAccountFaders(account.id, changes)
      } catch {
        toast.error(`Couldn't save the faders for @${account.handle}`)
      }
    })
  }

  function useDefault() {
    const reset = { ratio: null, replyRatio: null }
    setFaders(reset)
    save(reset)
  }

  // The server sets the new faders from the account's whole month, so the switch
  // itself doesn't change the feed: the same tweets get through, or as many.
  function toggleSplit(on: boolean) {
    startSaving(async () => {
      try {
        const next = await splitAccountFaders(account.id, on)
        startSaving(() => setFaders(next))
      } catch {
        toast.error(`Couldn't change the faders for @${account.handle}`)
      }
    })
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
              {!isTuned(faders) ? (
                `Using the default, ${describeRatio(defaultRatio).toLowerCase()}`
              ) : (
                <>
                  Set for this account ·{" "}
                  <button
                    type="button"
                    onClick={useDefault}
                    className="text-signal outline-none hover:underline focus-visible:underline"
                  >
                    Use the default
                  </button>
                </>
              )}
            </p>
          </div>
          {!split && <Level value={posts} tuned={faders.ratio !== null} className="text-[31px] leading-9" />}
        </div>

        {split ? (
          <>
            <KindFader
              label="Posts"
              perDay={account.perDay - account.repliesPerDay}
              read={account.lastSyncedAt !== null}
              value={posts}
              tuned={faders.ratio !== null}
              curve={account.curves.posts}
              handle={account.handle}
              onValueChange={(ratio) => setFaders({ ...faders, ratio })}
              onValueCommitted={(ratio) => save({ ratio })}
            />
            <KindFader
              label="Replies"
              perDay={account.repliesPerDay}
              read={account.lastSyncedAt !== null}
              value={replies}
              tuned
              curve={account.curves.replies}
              handle={account.handle}
              onValueChange={(replyRatio) => setFaders({ ...faders, replyRatio })}
              onValueCommitted={(replyRatio) => save({ replyRatio })}
            />
          </>
        ) : (
          <Fader
            value={posts}
            onValueChange={(ratio) => setFaders({ ...faders, ratio })}
            onValueCommitted={(ratio) => save({ ratio })}
            curve={account.curves.all}
            label={`Show from @${account.handle}`}
            size="lg"
            className="mt-3"
          />
        )}
        <p className="mt-1 flex justify-between text-[13px] text-muted-foreground">
          <span>best</span>
          <span>worst</span>
        </p>

        <label className="mt-4 flex cursor-pointer items-center justify-between gap-4">
          <span className="leading-5">
            <span id={`${splitId}-label`} className="block font-bold">
              Separate fader for replies
            </span>
            <span id={`${splitId}-hint`} className="block text-[13px] leading-4 text-muted-foreground">
              Rank their replies apart from their posts, and set each on its own.
            </span>
          </span>
          <Switch
            checked={split}
            onCheckedChange={toggleSplit}
            aria-labelledby={`${splitId}-label`}
            aria-describedby={`${splitId}-hint`}
          />
        </label>
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
          disabled={waitingForSync || muted}
          title={muted ? "Muted accounts aren't synced" : undefined}
        >
          <RefreshCwIcon className={cn(waitingForSync && "animate-spin")} aria-hidden />
          {waitingForSync ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      <ol className="divide-y border-b">
        {tweets.map((tweet) => {
          const through = getsThrough(tweet, faders, defaultRatio)
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
                showRank={split ? "kind" : "overall"}
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

/** A fader's setting: blue when set for the account, grey when it follows the default. */
function Level({ value, tuned, className }: { value: number; tuned: boolean; className?: string }) {
  return (
    <p
      className={cn(
        "readout shrink-0 font-extrabold tracking-tight",
        !tuned ? "text-muted-foreground" : value > 0 && "text-signal",
        className,
      )}
    >
      {describeRatio(value)}
    </p>
  )
}

/** One of a split pair: the fader for an account's posts, or for its replies. */
function KindFader({
  label,
  perDay,
  read,
  value,
  tuned,
  curve,
  handle,
  onValueChange,
  onValueCommitted,
}: {
  label: "Posts" | "Replies"
  perDay: number
  read: boolean
  value: number
  tuned: boolean
  curve: Bar[]
  handle: string
  onValueChange: (value: number) => void
  onValueCommitted: (value: number) => void
}) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="leading-5">
          <span className="font-bold">{label}</span>
          {read && <span className="readout text-muted-foreground"> · {formatPerDay(perDay)}</span>}
        </p>
        <Level value={value} tuned={tuned} className="text-xl leading-6" />
      </div>
      <Fader
        value={value}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
        curve={curve}
        label={`Show ${label.toLowerCase()} from @${handle}`}
        size="lg"
        className="mt-2"
      />
    </div>
  )
}
