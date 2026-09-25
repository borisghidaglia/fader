"use client"

import { CircleAlertIcon, LockIcon, RotateCcwIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { useDeferredValue, useState, useTransition } from "react"
import { toast } from "sonner"

import { saveAccountRatio, saveDefaultRatio } from "@/app/actions"
import { Desk, type Channel } from "@/components/desk"
import { Fader } from "@/components/fader"
import { TabButton, Tabs } from "@/components/page"
import { AuthorAvatar, VerifiedBadge } from "@/components/tweet/tweet-card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { describeRatio, formatPerDay, formatRate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Account } from "@/lib/types"

const PAGE = 100

type Show = "all" | "tuned" | "muted"
type Sort = "active" | "recent" | "name"

const shows: Record<Show, string> = {
  all: "All",
  tuned: "Tuned",
  muted: "Muted",
}

const sorts: Record<Sort, string> = {
  active: "Most active",
  recent: "Recently followed",
  name: "Name",
}

/** Every account you follow, each with its own fader, plus the default they fall back to. */
export function AccountsView({ accounts, defaultRatio: savedDefault }: { accounts: Account[]; defaultRatio: number }) {
  const [ratios, setRatios] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(accounts.map((a) => [a.id, a.ratio])),
  )
  const [defaultRatio, setDefaultRatio] = useState(savedDefault)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<Sort>("active")
  // Which accounts a filter shows is fixed when you pick it, so a row doesn't vanish
  // from "Muted" while you're raising its fader.
  const [show, setShow] = useState<{ kind: Show; ids: Set<string> | null }>({ kind: "all", ids: null })
  const [limit, setLimit] = useState(PAGE)
  const [, startSaving] = useTransition()

  const deferredQuery = useDeferredValue(query)
  const needle = deferredQuery.trim().replace(/^@/, "").toLowerCase()
  const matching = accounts
    .filter((a) => !show.ids || show.ids.has(a.id))
    .filter((a) => !needle || a.handle.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle))
    .sort(compareBy(sort))
  const visible = matching.slice(0, limit)

  let shownPerDay = 0
  let totalPerDay = 0
  let unread = 0
  const channels: Channel[] = []
  for (const a of accounts) {
    const ratio = ratios[a.id] ?? defaultRatio
    totalPerDay += a.perDay
    shownPerDay += a.perDay * ratio
    if (a.lastSyncedAt === null) unread++
    channels.push({ perDay: a.perDay, ratio, read: a.lastSyncedAt !== null })
  }

  function chooseShow(kind: Show) {
    const ids =
      kind === "all"
        ? null
        : new Set(
            accounts
              .filter((a) =>
                kind === "tuned" ? ratios[a.id] !== null : (ratios[a.id] ?? defaultRatio) === 0,
              )
              .map((a) => a.id),
          )
    setShow({ kind, ids })
    setLimit(PAGE)
  }

  function changeRatio(accountId: string, ratio: number | null) {
    setRatios((current) => ({ ...current, [accountId]: ratio }))
  }

  function commitRatio(account: Account, ratio: number | null) {
    startSaving(async () => {
      try {
        await saveAccountRatio(account.id, ratio)
      } catch {
        toast.error(`Couldn't save the fader for @${account.handle}`)
      }
    })
  }

  function resetRatio(account: Account) {
    changeRatio(account.id, null)
    commitRatio(account, null)
  }

  function commitDefault(ratio: number) {
    startSaving(async () => {
      try {
        await saveDefaultRatio(ratio)
      } catch {
        toast.error("Couldn't save the default fader")
      }
    })
  }

  return (
    <>
      <section aria-label="Your feed's volume" className="border-b px-4 pt-3 pb-4">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="readout text-[31px] leading-9 font-extrabold tracking-tight">≈{formatRate(shownPerDay)}</span>
          <span className="text-muted-foreground">posts a day in your feed</span>
        </p>
        <Desk channels={channels} className="mt-3" />
        <p className="mt-3 text-[13px] leading-4 text-muted-foreground">
          Out of ≈{formatRate(totalPerDay)} a day from the {accounts.length.toLocaleString("en")} accounts you follow,
          at their recent pace.
          {unread > 0 && ` ${unread.toLocaleString("en")} haven't been read yet, so this will grow.`}
        </p>
      </section>

      <section aria-label="Default" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b px-4 py-3">
        <div className="leading-5">
          <p className="font-bold">Default</p>
          <p className="text-[13px] leading-4 text-muted-foreground">For every account you haven&apos;t set yourself.</p>
        </div>
        <Readout value={defaultRatio} />
        <Fader
          value={defaultRatio}
          onValueChange={setDefaultRatio}
          onValueCommitted={commitDefault}
          curve={[]}
          label="Default for accounts you haven't set"
          className="col-span-2 mt-2"
        />
      </section>

      <div className="z-20 bg-background/65 backdrop-blur-md sm:sticky sm:top-[53px]">
        <div className="flex items-center gap-2 px-4 py-1.5">
          <label className="group relative min-w-0 flex-1">
            <span className="sr-only">Search accounts</span>
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground group-focus-within:text-signal"
              strokeWidth={2.25}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setLimit(PAGE)
              }}
              placeholder="Search accounts"
              className="h-[42px] w-full rounded-full border border-transparent bg-field pr-4 pl-12 text-[15px] outline-none placeholder:text-muted-foreground focus:border-signal focus:bg-background"
            />
          </label>
          <Select
            value={sort}
            onValueChange={(value) => {
              if (value) setSort(value as Sort)
              setLimit(PAGE)
            }}
            items={sorts}
          >
            <SelectTrigger aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              {Object.entries(sorts).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Tabs label="Show">
          {(Object.keys(shows) as Show[]).map((kind) => (
            <TabButton key={kind} active={show.kind === kind} onClick={() => chooseShow(kind)}>
              {shows[kind]}
            </TabButton>
          ))}
        </Tabs>
      </div>

      {visible.length > 0 ? (
        <ul className="divide-y border-b">
          {visible.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              ratio={ratios[account.id]}
              defaultRatio={defaultRatio}
              onChange={changeRatio}
              onCommit={commitRatio}
              onReset={resetRatio}
            />
          ))}
        </ul>
      ) : (
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyTitle>
              {needle
                ? `No results for “${deferredQuery.trim()}”`
                : show.kind === "tuned"
                  ? "Nothing tuned yet"
                  : "Nobody's muted"}
            </EmptyTitle>
            <EmptyDescription>
              {needle
                ? "Try a name or an @handle."
                : show.kind === "tuned"
                  ? "Move an account's fader to give it its own setting."
                  : "Pull an account's fader all the way down to mute it."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {matching.length > visible.length && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="flex w-full items-center justify-between border-b px-4 py-4 text-left transition-colors outline-none hover:bg-foreground/[0.03] focus-visible:bg-hover"
        >
          <span className="text-signal">Show {Math.min(PAGE, matching.length - visible.length)} more</span>
          <span className="readout text-[13px] text-muted-foreground">
            {visible.length} of {matching.length}
          </span>
        </button>
      )}
    </>
  )
}

function AccountRow({
  account,
  ratio,
  defaultRatio,
  onChange,
  onCommit,
  onReset,
}: {
  account: Account
  ratio: number | null
  defaultRatio: number
  onChange: (accountId: string, ratio: number) => void
  onCommit: (account: Account, ratio: number) => void
  onReset: (account: Account) => void
}) {
  const value = ratio ?? defaultRatio
  const tuned = ratio !== null

  return (
    <li
      className={cn(
        "grid grid-cols-[2.5rem_minmax(0,1fr)_auto_2.125rem] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-foreground/[0.03]",
        "sm:grid-cols-[2.5rem_minmax(0,10rem)_minmax(0,1fr)_5rem_2.125rem]",
        "[contain-intrinsic-size:auto_64px] [content-visibility:auto]",
      )}
    >
      <AuthorAvatar name={account.name} src={account.avatarUrl} className="size-10" />

      <div className="min-w-0 leading-5">
        <Link href={`/accounts/${account.handle}`} className="group flex min-w-0 items-center gap-0.5 font-bold">
          <span className="truncate group-hover:underline">{account.name}</span>
          {account.verified && <VerifiedBadge />}
          {account.protected && <LockIcon className="size-4 shrink-0" role="img" aria-label="Protected account" />}
        </Link>
        <p className="flex min-w-0 items-center gap-1 text-muted-foreground">
          <span className="truncate">@{account.handle}</span>
          <span aria-hidden>·</span>
          <span className="readout shrink-0">
            {account.lastSyncedAt === null ? "not read yet" : formatPerDay(account.perDay)}
          </span>
          {account.lastError && (
            <span title={`Last sync failed: ${account.lastError}`} className="shrink-0">
              <CircleAlertIcon className="size-4 text-destructive" aria-hidden />
              <span className="sr-only">Last sync failed: {account.lastError}</span>
            </span>
          )}
        </p>
      </div>

      <Fader
        value={value}
        onValueChange={(next) => onChange(account.id, next)}
        onValueCommitted={(next) => onCommit(account, next)}
        curve={account.curve}
        label={`Show from @${account.handle}`}
        className="col-[2/-1] row-start-2 sm:col-[3] sm:row-start-1"
      />

      <Readout value={value} perDay={account.lastSyncedAt === null ? null : account.perDay * value} tuned={tuned} />

      {tuned ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => onReset(account)}
                aria-label={`Use the default for @${account.handle}`}
                className="flex size-[34px] items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-signal/10 hover:text-signal focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          >
            <RotateCcwIcon className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </TooltipTrigger>
          <TooltipContent>Use the default ({describeRatio(defaultRatio)})</TooltipContent>
        </Tooltip>
      ) : (
        <span aria-hidden />
      )}
    </li>
  )
}

/** The fader's setting, blue when set by hand, and roughly how many posts a day it lets through. */
function Readout({ value, perDay, tuned = true }: { value: number; perDay?: number | null; tuned?: boolean }) {
  return (
    <div className="readout text-right leading-5">
      <p className={cn("font-bold", !tuned ? "text-muted-foreground" : value > 0 && "text-signal")}>
        {describeRatio(value)}
      </p>
      {perDay !== undefined && (
        <p className="text-[13px] leading-4 text-muted-foreground">
          {perDay === null ? "—" : perDay === 0 ? "none" : `≈${formatPerDay(perDay)}`}
        </p>
      )}
    </div>
  )
}

function compareBy(sort: Sort) {
  return (a: Account, b: Account) => {
    if (sort === "active") return b.perDay - a.perDay || a.name.localeCompare(b.name)
    // Lower follow order = followed more recently; accounts without one go last.
    if (sort === "recent") return (a.followOrder ?? Number.MAX_SAFE_INTEGER) - (b.followOrder ?? Number.MAX_SAFE_INTEGER)
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  }
}

