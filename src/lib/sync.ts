import type { Tweet } from "rettiwt-api"

import {
  activityPerDay,
  knownTweetIds,
  markAccountSynced,
  markUnfollowedExcept,
  saveFollowing,
  saveTweets,
  updateSyncStatus,
  type SyncTarget,
} from "@/lib/store"
import { AuthError, RateLimitedError, UnavailableError, type XClient } from "@/lib/x/client"
import { toIncomingTweets } from "@/lib/x/normalize"

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Stop paging the Following tab after this many pages even if we haven't caught up. */
const MAX_FEED_PAGES = 5
/** Pages of history fetched the first time we see an account (~20 tweets each). */
export const FIRST_SYNC_PAGES = 2
/** Pages fetched to catch up with an account that posted a lot since last time. */
const MAX_CATCHUP_PAGES = 3

/** Reads your full following list and marks accounts you no longer follow. */
export async function syncFollowing(x: XClient): Promise<number> {
  const ids: string[] = []
  let cursor: string | undefined
  for (;;) {
    updateSyncStatus({ state: "syncing", message: `Reading your following list (${ids.length} so far)` })
    const { accounts, next } = await x.following(cursor)
    saveFollowing(accounts, ids.length)
    ids.push(...accounts.map((a) => a.id))
    if (accounts.length === 0 || !next) break
    cursor = next
  }
  if (ids.length > 0) markUnfollowedExcept(ids)
  updateSyncStatus({ lastFollowingSyncAt: Date.now() })
  return ids.length
}

/**
 * Polls X's chronological Following tab: the cheapest way to pick up new posts from
 * everyone at once. Pages back until it reaches tweets it already has.
 */
export async function syncFeed(x: XClient): Promise<number> {
  updateSyncStatus({ state: "syncing", message: "Checking for new posts" })
  let saved = 0
  let cursor: string | undefined
  for (let page = 0; page < MAX_FEED_PAGES; page++) {
    const { tweets, next } = await x.homeFeed(cursor)
    const incoming = toIncomingTweets(tweets)
    // Replies arrive under the post they answer, which we often have already: judge
    // by the entries alone. Mostly known, not one known, means we've caught up.
    const context = contextIds(tweets)
    const entries = incoming.filter((t) => !context.has(t.id))
    const known = knownTweetIds(entries.map((t) => t.id)).size
    const caughtUp = entries.length > 0 && known >= entries.length / 2
    saved += saveTweets(incoming)
    if (caughtUp || !next || tweets.length === 0) break
    cursor = next
  }
  updateSyncStatus({ lastFeedSyncAt: Date.now() })
  return saved
}

/**
 * Reads one account's "posts & replies" timeline. The Following tab skips most
 * replies, and this also refreshes engagement on their recent tweets. Returns the
 * error recorded against the account if the read failed.
 */
export async function syncAccount(x: XClient, target: SyncTarget): Promise<string | null> {
  const known = target.newestSeenId ? BigInt(target.newestSeenId) : null
  const maxPages = known === null ? FIRST_SYNC_PAGES : MAX_CATCHUP_PAGES
  let newest: bigint | null = null
  let oldestAt: number | null = null
  // How far back we've now read without gaps: kept as is (null) once we reach what
  // the last sync read, 0 at the start of their timeline, else the oldest tweet read.
  let coveredSince: number | null = null
  let cursor: string | undefined

  try {
    for (let page = 0; page < maxPages; page++) {
      let result
      try {
        result = await x.timeline(target.id, cursor)
      } catch (error) {
        // Out of requests partway through: keep what was read rather than throwing it
        // away and reading the same pages again once there's room.
        if (error instanceof RateLimitedError && page > 0) {
          coveredSince = oldestAt
          break
        }
        throw error
      }
      const { tweets, next } = result
      saveTweets(toIncomingTweets(tweets))

      // Judge how far back we've read by their own entries, newest first. The pinned
      // tweet sits on top of every page, and replies bring the conversation they
      // answer, which can be far older (a reply under their own post from months ago).
      const pinned = new Set(
        tweets.flatMap((t) => (t.tweetBy.id === target.id ? t.tweetBy.pinnedTweets : [])),
      )
      const context = contextIds(tweets)
      const own = tweets.filter(
        (t) => t.tweetBy.id === target.id && !pinned.has(t.id) && !context.has(t.id),
      )
      for (const t of own) {
        const id = BigInt(t.id)
        if (newest === null || id > newest) newest = id
        const at = Date.parse(t.createdAt)
        if (oldestAt === null || at < oldestAt) oldestAt = at
      }

      if (known !== null && own.some((t) => BigInt(t.id) <= known)) break
      if (!next || tweets.length === 0) {
        coveredSince = 0
        break
      }
      if (page === maxPages - 1) coveredSince = oldestAt
      cursor = next
    }
    markAccountSynced(target.id, {
      newestSeenId: newest?.toString() ?? null,
      coveredSince,
      nextSyncAt: Date.now() + syncInterval(activityPerDay(target.id)),
      error: null,
    })
    return null
  } catch (error) {
    // Not about this account: leave it due, for the worker to retry once X is back.
    if (
      error instanceof RateLimitedError ||
      error instanceof AuthError ||
      error instanceof UnavailableError
    ) {
      throw error
    }
    // Leave newest_seen_id alone so the next read pages back over anything missed.
    const message = error instanceof Error ? error.message : String(error)
    markAccountSynced(target.id, {
      newestSeenId: null,
      coveredSince: null,
      nextSyncAt: Date.now() + HOUR,
      error: message,
    })
    return message
  }
}

/**
 * Tweets on a page that are only there as context: ones another tweet on the page
 * answers, directly or further down the thread (X can collapse the middle of a
 * thread, leaving its first post right above the latest reply).
 */
function contextIds(tweets: Tweet[]): Set<string> {
  const ids = new Set<string>()
  for (const t of tweets) {
    if (t.replyTo) ids.add(t.replyTo)
    if (t.conversationId && t.conversationId !== t.id) ids.add(t.conversationId)
  }
  return ids
}

/**
 * How long until an account's timeline is read again: every 12 hours for someone who
 * rarely posts, down to every 30 minutes for someone posting 20+ times a day.
 * New posts arrive sooner through the Following tab; this mostly catches replies.
 */
export function syncInterval(postsPerDay: number): number {
  const interval = Math.min(12 * HOUR, Math.max(30 * MINUTE, (12 * HOUR) / (postsPerDay + 1)))
  return interval * (0.9 + Math.random() * 0.2)
}
