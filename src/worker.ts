// The sync worker: keeps the local database in step with X.
//
//   pnpm worker        run forever (started alongside the app by `pnpm dev`)
//   pnpm sync          one pass (following list, new posts, due accounts), then exit

import { existsSync, readFileSync } from "node:fs"
import { parseEnv } from "node:util"

import {
  claimWorker,
  countFollowedAccounts,
  dueAccounts,
  getSyncStatus,
  nextAccountDueAt,
  rerankAll,
  syncProgress,
  takeSyncRequest,
  updateSyncStatus,
} from "@/lib/store"
import { FIRST_SYNC_PAGES, syncAccount, syncFeed, syncFollowing } from "@/lib/sync"
import {
  AuthError,
  credentialsFromEnv,
  RateLimitedError,
  UnavailableError,
  XClient,
  type Operation,
} from "@/lib/x/client"

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

const FEED_INTERVAL_MS = 5 * MINUTE
const FOLLOWING_REFRESH_MS = 24 * HOUR
const HEARTBEAT_MS = 10 * SECOND
/** After a step fails for reasons other than a rate limit, wait this long before retrying it. */
const STEP_RETRY_MS = 15 * MINUTE
/** This many account reads failing in a row points at X rather than the accounts. */
const MAX_FAILED_READS_IN_A_ROW = 3

const once = process.argv.includes("--once")

type Step = "following" | "feed" | "accounts"

type Schedule = {
  nextFeedAt: number
  nextFollowingAttemptAt: number
  accountsPausedUntil: number
  /** What's failing right now, by step; cleared once the step works again. */
  problems: Map<Step, string>
}

async function main() {
  const other = claimWorker(process.pid, isRunning)
  if (other !== null) {
    console.error(
      `Another sync worker is already running (process ${other}). Stop it first: two would double the requests to X.`,
    )
    process.exit(1)
  }
  rerankAll()

  let x = connect()
  const schedule: Schedule = {
    nextFeedAt: 0,
    nextFollowingAttemptAt: 0,
    accountsPausedUntil: 0,
    problems: new Map(),
  }

  for (;;) {
    let wakeAt: number
    try {
      if (!x) throw new AuthError(credentialError ?? "Missing X cookies")
      wakeAt = await runPass(x, schedule)
    } catch (error) {
      // The stack only, never the whole object: HTTP errors carry request headers (your cookies).
      if (!(error instanceof AuthError)) console.error(error instanceof Error ? error.stack : String(error))
      const message = error instanceof Error ? error.message : String(error)
      updateSyncStatus({ state: "error", message, error: message })
      if (once) process.exit(1)
      // Wait for fresh cookies in .env.local (re-read on every attempt).
      await sleepUntil(Date.now() + (error instanceof AuthError ? 30 * SECOND : MINUTE))
      x = connect() ?? x
      continue
    }

    if (once && wakeAt > Date.now()) {
      const { synced, total } = syncProgress()
      console.log(`Done. ${synced}/${total} accounts synced at least once.`)
      return
    }
    if (await sleepUntil(wakeAt)) retryNow(schedule)
  }
}

/** "Sync now": check for new posts, and retry anything that was backing off. */
function retryNow(schedule: Schedule) {
  schedule.nextFeedAt = 0
  schedule.nextFollowingAttemptAt = 0
  schedule.accountsPausedUntil = 0
}

/**
 * One round of work. Returns when there's nothing to do right now, with the time
 * the next piece of work becomes possible.
 */
async function runPass(x: XClient, schedule: Schedule): Promise<number> {
  const readyAt = (operation: Operation) => Date.now() + x.waitFor(operation)
  // Start an account only with room to read it whole, so a first sync isn't cut short.
  const accountWait = () => x.waitFor("UserTweetsAndReplies", Date.now(), FIRST_SYNC_PAGES)

  // 1. Your following list, once a day.
  const status = getSyncStatus()
  const followingStale =
    countFollowedAccounts() === 0 ||
    !status.lastFollowingSyncAt ||
    Date.now() - status.lastFollowingSyncAt > FOLLOWING_REFRESH_MS
  if (followingStale && Date.now() >= schedule.nextFollowingAttemptAt && x.waitFor("Following") === 0) {
    const result = await attempt(() => syncFollowing(x))
    if (result.done) log(`Following list: ${result.value} accounts`)
    record(schedule, "following", result, "Couldn't read your following list")
    if (result.error) schedule.nextFollowingAttemptAt = Date.now() + STEP_RETRY_MS
  }

  // 2. New posts from everyone, via X's own Following tab, every few minutes.
  if (Date.now() >= schedule.nextFeedAt && x.waitFor("HomeLatestTimeline") === 0) {
    const result = await attempt(() => syncFeed(x))
    if (result.done) log(`Following tab: ${result.value} tweets saved`)
    record(schedule, "feed", result, "Couldn't check the Following tab")
    schedule.nextFeedAt = once ? Infinity : Date.now() + (result.error ? STEP_RETRY_MS : FEED_INTERVAL_MS)
  }

  // 3. Account timelines, for replies and fresh numbers, until the feed is due again.
  const feedAt = () => Math.max(schedule.nextFeedAt, readyAt("HomeLatestTimeline"))
  let failedInARow = 0
  while (
    Date.now() < feedAt() &&
    Date.now() >= schedule.accountsPausedUntil &&
    accountWait() === 0
  ) {
    const [target] = dueAccounts(Date.now(), 1)
    if (!target) break
    const { synced, total } = syncProgress()
    updateSyncStatus({
      state: "syncing",
      message: `Reading @${target.handle}`,
      accountsSynced: synced,
      accountsTotal: total,
      rateLimitedUntil: null,
    })
    const result = await attempt(() => syncAccount(x, target))
    // syncAccount records most failures against the account and returns them.
    const error = result.done ? result.value : result.error
    if (error) {
      log(`@${target.handle} failed: ${error}`)
      if (++failedInARow >= MAX_FAILED_READS_IN_A_ROW) {
        schedule.accountsPausedUntil = Date.now() + STEP_RETRY_MS
        schedule.problems.set(
          "accounts",
          `Couldn't read ${failedInARow} accounts in a row, so trying again in 15 minutes: ${error}`,
        )
        break
      }
    } else if (result.done) {
      log(`@${target.handle} synced`)
      failedInARow = 0
      schedule.problems.delete("accounts")
    }
    if (!once && takeSyncRequest()) {
      retryNow(schedule)
      return Date.now()
    }
  }

  // Nothing left to do right now: work out when there will be.
  const accountsDue = nextAccountDueAt()
  const accountsAt =
    accountsDue === null
      ? Infinity
      : Math.max(accountsDue, Date.now() + accountWait(), schedule.accountsPausedUntil)
  const wakeAt = Math.min(feedAt(), accountsAt)
  // Accounts are waiting to be read but the pacing (or X's limit) says not yet.
  const wait = accountWait()
  const limitedUntil = accountsDue !== null && accountsDue <= Date.now() && wait > 0 ? Date.now() + wait : null
  const { synced, total } = syncProgress()
  updateSyncStatus({
    state: "waiting",
    message: limitedUntil
      ? `Spacing out reads: the next one is at ${formatTime(limitedUntil)}`
      : "Up to date",
    accountsSynced: synced,
    accountsTotal: total,
    rateLimitedUntil: limitedUntil,
    error: [...schedule.problems.values()][0] ?? null,
  })
  return wakeAt
}

/** done: it ran. Otherwise X's rate limit held it off (error null), or it failed. */
type Attempt<T> = { done: true; value: T; error: null } | { done: false; error: string | null }

/**
 * Runs one step of a pass. A rate limit isn't a failure: the client holds off until
 * it resets. Expired cookies and X being unreachable stop the whole pass; anything
 * else fails just this step, so one broken endpoint doesn't hold up the others.
 */
async function attempt<T>(step: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { done: true, value: await step(), error: null }
  } catch (error) {
    if (error instanceof AuthError || error instanceof UnavailableError) throw error
    if (error instanceof RateLimitedError) {
      log(error.message)
      return { done: false, error: null }
    }
    // The stack only, never the whole object: HTTP errors carry request headers (your cookies).
    console.error(error instanceof Error ? error.stack : String(error))
    return { done: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Notes a step's failure for the status light, or clears it once the step works. */
function record(schedule: Schedule, step: Step, result: Attempt<unknown>, failure: string) {
  if (result.error) schedule.problems.set(step, `${failure}: ${result.error}`)
  else if (result.done) schedule.problems.delete(step)
}

/** Sleeps until `at`, heartbeating. Returns early (true) if the app asks for a sync. */
async function sleepUntil(at: number): Promise<boolean> {
  let lastBeat = 0
  while (Date.now() < at) {
    if (takeSyncRequest()) return true
    if (Date.now() - lastBeat >= HEARTBEAT_MS) {
      updateSyncStatus({})
      lastBeat = Date.now()
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(2 * SECOND, at - Date.now())))
  }
  return false
}

let credentialError: string | null = null

/** Reads the cookies from .env.local afresh, so updating the file needs no restart. */
function connect(): XClient | null {
  if (existsSync(".env.local")) {
    Object.assign(process.env, parseEnv(readFileSync(".env.local", "utf8")))
  }
  try {
    const x = new XClient(credentialsFromEnv())
    credentialError = null
    return x
  } catch (error) {
    credentialError = error instanceof Error ? error.message : String(error)
    return null
  }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0) // signal 0 only checks that the process exists
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function log(message: string) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`)
}

void main()
