import { engagementCurve, type Bar } from "@/lib/curve"
import { getDb, transaction } from "@/lib/db"
import { refit, shownPerDay, type Faders } from "@/lib/faders"
import { RANK_WINDOW_MS, rankAuthorTweets } from "@/lib/ranking"
import type {
  Account,
  FeedCursor,
  FeedItem,
  SyncStatus,
  TweetContent,
  TweetKind,
} from "@/lib/types"
import type { IncomingAccount, IncomingTweet } from "@/lib/x/normalize"

// All SQL lives here. Used by both the web app and the sync worker.

const DAY = 86_400_000

type Row = Record<string, unknown>

// ─── Settings & worker coordination ─────────────────────────────────────────

function getKv<T>(key: string): T | null {
  const row = getDb().prepare("SELECT value FROM kv WHERE key = ?").get(key) as Row | undefined
  return row ? (JSON.parse(row.value as string) as T) : null
}

function setKv(key: string, value: unknown): void {
  getDb()
    .prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value))
}

/** Share of posts shown for accounts you haven't tuned. 1 = everything, like X's Following tab. */
export function getDefaultRatio(): number {
  return getKv<number>("default_ratio") ?? 1
}

export function setDefaultRatio(ratio: number): void {
  setKv("default_ratio", clampRatio(ratio))
}

const IDLE_STATUS: SyncStatus = {
  state: "idle",
  message: "Waiting for the first sync",
  heartbeatAt: 0,
  lastFeedSyncAt: null,
  lastFollowingSyncAt: null,
  accountsSynced: 0,
  accountsTotal: 0,
  rateLimitedUntil: null,
  error: null,
}

export function getSyncStatus(): SyncStatus {
  return { ...IDLE_STATUS, ...getKv<Partial<SyncStatus>>("sync_status") }
}

export function updateSyncStatus(patch: Partial<SyncStatus>): SyncStatus {
  const next = { ...getSyncStatus(), ...patch, heartbeatAt: Date.now() }
  setKv("sync_status", next)
  return next
}

/**
 * Claims the one worker slot for process `pid`. Returns the pid of a worker that's
 * already running (this one should exit: two would double the requests to X),
 * or null once the slot is ours.
 */
export function claimWorker(pid: number, isRunning: (pid: number) => boolean): number | null {
  return transaction(() => {
    const holder = getKv<number>("worker_pid")
    const alive = Date.now() - getSyncStatus().heartbeatAt < 2 * 60_000
    if (holder !== null && holder !== pid && alive && isRunning(holder)) return holder
    setKv("worker_pid", pid)
    return null
  })
}

/** Asks the worker to sync now instead of waiting for its next scheduled run. */
export function requestSync(): void {
  setKv("sync_requested_at", Date.now())
}

/** Returns true (once) if a sync was requested since the last call. */
export function takeSyncRequest(): boolean {
  const requested = getKv<number>("sync_requested_at")
  if (requested === null) return false
  getDb().prepare("DELETE FROM kv WHERE key = 'sync_requested_at'").run()
  return true
}

// ─── Accounts ───────────────────────────────────────────────────────────────

/** Saves one page of your following list. `startOrder` is the page's offset in the list. */
export function saveFollowing(accounts: IncomingAccount[], startOrder: number): void {
  const upsert = getDb().prepare(`
    INSERT INTO accounts (id, handle, name, avatar_url, bio, followers_count, verified, protected, following, follow_order)
    VALUES (:id, :handle, :name, :avatarUrl, :bio, :followersCount, :verified, :protected, 1, :followOrder)
    ON CONFLICT (id) DO UPDATE SET
      handle = excluded.handle, name = excluded.name, avatar_url = excluded.avatar_url, bio = excluded.bio,
      followers_count = excluded.followers_count, verified = excluded.verified, protected = excluded.protected,
      following = 1, follow_order = excluded.follow_order
  `)
  transaction(() => {
    accounts.forEach((a, i) =>
      upsert.run({
        id: a.id,
        handle: a.handle,
        name: a.name,
        avatarUrl: a.avatarUrl,
        bio: a.bio,
        followersCount: a.followersCount,
        verified: a.verified ? 1 : 0,
        protected: a.protected ? 1 : 0,
        followOrder: startOrder + i,
      }),
    )
  })
}

/** After a complete pass over your following list, marks everyone else as unfollowed. */
export function markUnfollowedExcept(followingIds: string[]): number {
  const db = getDb()
  return transaction(() => {
    db.exec("CREATE TEMP TABLE IF NOT EXISTS still_following (id TEXT PRIMARY KEY)")
    db.exec("DELETE FROM still_following")
    const insert = db.prepare("INSERT OR IGNORE INTO still_following (id) VALUES (?)")
    for (const id of followingIds) insert.run(id)
    const result = db
      .prepare("UPDATE accounts SET following = 0 WHERE following = 1 AND id NOT IN (SELECT id FROM still_following)")
      .run()
    return Number(result.changes)
  })
}

export function followedAccountIds(): Set<string> {
  const rows = getDb().prepare("SELECT id FROM accounts WHERE following = 1").all() as Row[]
  return new Set(rows.map((r) => r.id as string))
}

export function countFollowedAccounts(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM accounts WHERE following = 1").get() as Row
  return Number(row.n)
}

/**
 * An account's recent tweets, over the last week or the part of it we've read
 * without gaps: a first sync of a prolific account covers only its last day or so.
 * Needs :weekAgo; read with pace().
 */
const ACTIVITY_COLUMNS = `
  MAX(:weekAgo, COALESCE(a.covered_since, 0)) AS activity_since,
  (
    SELECT COUNT(*) FROM tweets t
    WHERE t.author_id = a.id AND t.created_at >= MAX(:weekAgo, COALESCE(a.covered_since, 0))
  ) AS activity_count,
  (
    SELECT COUNT(*) FROM tweets t
    WHERE t.author_id = a.id AND t.created_at >= MAX(:weekAgo, COALESCE(a.covered_since, 0)) AND t.kind = 'reply'
  ) AS activity_replies`

/** Tweets a day, and how many of them are replies. */
function pace(row: Row, now = Date.now()): { perDay: number; repliesPerDay: number } {
  const days = Math.max(1, (now - Number(row.activity_since)) / DAY)
  return { perDay: Number(row.activity_count) / days, repliesPerDay: Number(row.activity_replies) / days }
}

function faders(row: Row): Faders {
  return { ratio: row.ratio as number | null, replyRatio: row.reply_ratio as number | null }
}

export function listAccounts(): Account[] {
  const rows = getDb()
    .prepare(`
      SELECT a.*, ${ACTIVITY_COLUMNS}
      FROM accounts a
      WHERE a.following = 1
      ORDER BY a.follow_order IS NULL, a.follow_order
    `)
    .all({ weekAgo: Date.now() - 7 * DAY }) as Row[]
  const ranked = rankedBestFirst()
  return rows.map((row) => toAccount(row, ranked.get(row.id as string)))
}

/** An account, by how many of its posts reach your feed each day. */
export type FeedSource = Pick<Account, "id" | "handle" | "name" | "avatarUrl" | "verified"> & { perDay: number }

/** How many posts a day reach your feed, and the accounts most of them come from. */
export function feedMix(limit: number): { perDay: number; loudest: FeedSource[] } {
  const now = Date.now()
  const rows = getDb()
    .prepare(`
      SELECT a.id, a.handle, a.name, a.avatar_url, a.verified, a.ratio, a.reply_ratio, ${ACTIVITY_COLUMNS}
      FROM accounts a WHERE a.following = 1
    `)
    .all({ weekAgo: now - 7 * DAY }) as Row[]
  const defaultRatio = getDefaultRatio()
  const sources = rows.map((row) => ({
    id: row.id as string,
    handle: row.handle as string,
    name: row.name as string,
    avatarUrl: row.avatar_url as string | null,
    verified: row.verified === 1,
    perDay: shownPerDay(pace(row, now), faders(row), defaultRatio),
  }))
  return {
    perDay: sources.reduce((sum, source) => sum + source.perDay, 0),
    loudest: sources
      .filter((source) => source.perDay > 0)
      .sort((a, b) => b.perDay - a.perDay)
      .slice(0, limit),
  }
}

export function getAccountByHandle(handle: string): Account | null {
  const row = getDb()
    .prepare(`
      SELECT a.*, ${ACTIVITY_COLUMNS}
      FROM accounts a WHERE a.handle = :handle COLLATE NOCASE
    `)
    .get({ handle, weekAgo: Date.now() - 7 * DAY }) as Row | undefined
  return row ? toAccount(row, rankedBestFirst(row.id as string).get(row.id as string)) : null
}

type Ranked = { score: number; top: number }[]

/**
 * Each account's ranked tweets within the rank window, best first: all together,
 * and posts and replies apart (ranked by their `kind_top`, for split faders).
 */
function rankedBestFirst(accountId?: string): Map<string, { all: Ranked; posts: Ranked; replies: Ranked }> {
  const rows = getDb()
    .prepare(`
      SELECT t.author_id, t.kind, t.score, t.top, t.kind_top FROM tweets t JOIN accounts a ON a.id = t.author_id
      WHERE a.following = 1 AND t.created_at >= :windowStart AND t.score IS NOT NULL
        AND (:accountId IS NULL OR t.author_id = :accountId)
      ORDER BY t.author_id, t.top
    `)
    .all({ windowStart: Date.now() - RANK_WINDOW_MS, accountId: accountId ?? null }) as Row[]
  const ranked = new Map<string, { all: Ranked; posts: Ranked; replies: Ranked }>()
  for (const row of rows) {
    const id = row.author_id as string
    let lists = ranked.get(id)
    if (!lists) ranked.set(id, (lists = { all: [], posts: [], replies: [] }))
    const score = row.score as number
    lists.all.push({ score, top: row.top as number })
    // Best first within the kind too: the same order by score, so by kind_top.
    lists[row.kind === "reply" ? "replies" : "posts"].push({ score, top: row.kind_top as number })
  }
  return ranked
}

const NO_CURVES = { all: [] as Bar[], posts: [] as Bar[], replies: [] as Bar[] }

function toAccount(row: Row, ranked?: { all: Ranked; posts: Ranked; replies: Ranked }): Account {
  return {
    id: row.id as string,
    handle: row.handle as string,
    name: row.name as string,
    avatarUrl: row.avatar_url as string | null,
    bio: row.bio as string | null,
    followersCount: Number(row.followers_count),
    verified: row.verified === 1,
    protected: row.protected === 1,
    followOrder: row.follow_order as number | null,
    ...faders(row),
    lastSyncedAt: row.last_synced_at as number | null,
    lastError: row.last_error as string | null,
    ...pace(row),
    curves: ranked
      ? {
          all: engagementCurve(ranked.all),
          posts: engagementCurve(ranked.posts),
          replies: engagementCurve(ranked.replies),
        }
      : NO_CURVES,
  }
}

/**
 * Sets the faders given and leaves the other alone, so a page that's out of date can't
 * undo it. `{ ratio: null, replyRatio: null }` puts the account back on the default.
 */
export function setAccountFaders(accountId: string, { ratio, replyRatio }: Partial<Faders>): void {
  const clamped = (value: number | null | undefined) => (value == null ? null : clampRatio(value))
  getDb()
    .prepare(`
      UPDATE accounts SET
        ratio = IIF(:setRatio, :ratio, ratio),
        reply_ratio = IIF(:setReplyRatio, :replyRatio, reply_ratio)
      WHERE id = :accountId
    `)
    .run({
      setRatio: Number(ratio !== undefined),
      ratio: clamped(ratio),
      setReplyRatio: Number(replyRatio !== undefined),
      replyRatio: clamped(replyRatio),
      accountId,
    })
}

/** Gives an account's replies a fader of their own, or folds it back in (see `refit`). */
export function setAccountSplit(accountId: string, split: boolean): Faders {
  return transaction(() => {
    const db = getDb()
    const row = db.prepare("SELECT ratio, reply_ratio FROM accounts WHERE id = ?").get(accountId) as Row | undefined
    if (!row) throw new Error(`No account ${accountId}`)
    const tweets = db
      .prepare(`
        SELECT kind, top, kind_top FROM tweets
        WHERE author_id = ? AND created_at >= ? AND score IS NOT NULL
      `)
      .all(accountId, Date.now() - RANK_WINDOW_MS)
      .map((t) => ({ kind: t.kind as TweetKind, top: t.top as number, kindTop: t.kind_top as number }))
    const next = refit(faders(row), split, tweets, getDefaultRatio())
    setAccountFaders(accountId, next)
    return next
  })
}

/** Some of what the account says gets through. Needs :defaultRatio. */
const NOT_MUTED = `MAX(COALESCE(ratio, :defaultRatio), COALESCE(reply_ratio, ratio, :defaultRatio)) > 0`

export type SyncTarget = { id: string; handle: string; newestSeenId: string | null }

/** Followed accounts whose timeline is due for a sync. Muted accounts are never synced. */
export function dueAccounts(now: number, limit: number): SyncTarget[] {
  const rows = getDb()
    .prepare(`
      SELECT id, handle, newest_seen_id FROM accounts
      WHERE following = 1 AND next_sync_at <= :now AND ${NOT_MUTED}
      ORDER BY next_sync_at, follow_order
      LIMIT :limit
    `)
    .all({ now, limit, defaultRatio: getDefaultRatio() }) as Row[]
  return rows.map((r) => ({
    id: r.id as string,
    handle: r.handle as string,
    newestSeenId: r.newest_seen_id as string | null,
  }))
}

/** When the next account becomes due, or null if none will. */
export function nextAccountDueAt(): number | null {
  const row = getDb()
    .prepare(`
      SELECT MIN(next_sync_at) AS at FROM accounts
      WHERE following = 1 AND ${NOT_MUTED}
    `)
    .get({ defaultRatio: getDefaultRatio() }) as Row
  return (row.at as number | null) ?? null
}

/** How many of the syncable accounts have been synced at least once. */
export function syncProgress(): { synced: number; total: number } {
  const row = getDb()
    .prepare(`
      SELECT COUNT(last_synced_at) AS synced, COUNT(*) AS total FROM accounts
      WHERE following = 1 AND ${NOT_MUTED}
    `)
    .get({ defaultRatio: getDefaultRatio() }) as Row
  return { synced: Number(row.synced), total: Number(row.total) }
}

/** `null` for newestSeenId or coveredSince keeps what's stored. */
export function markAccountSynced(
  accountId: string,
  result: { newestSeenId: string | null; coveredSince: number | null; nextSyncAt: number; error: string | null },
): void {
  getDb()
    .prepare(`
      UPDATE accounts SET
        newest_seen_id = COALESCE(:newestSeenId, newest_seen_id),
        covered_since = COALESCE(:coveredSince, covered_since),
        next_sync_at = :nextSyncAt,
        last_synced_at = CASE WHEN :error IS NULL THEN :now ELSE last_synced_at END,
        last_error = :error
      WHERE id = :accountId
    `)
    .run({ accountId, ...result, nextSyncAt: Math.round(result.nextSyncAt), now: Date.now() })
}

/** Moves an account to the front of the sync queue, ahead of those never read (0). */
export function requestAccountSync(accountId: string): void {
  getDb().prepare("UPDATE accounts SET next_sync_at = -1 WHERE id = ?").run(accountId)
}

/** Posts + replies per day lately. */
export function activityPerDay(accountId: string): number {
  const row = getDb()
    .prepare(`SELECT ${ACTIVITY_COLUMNS} FROM accounts a WHERE a.id = :accountId`)
    .get({ accountId, weekAgo: Date.now() - 7 * DAY }) as Row | undefined
  return row ? pace(row).perDay : 0
}

// ─── Tweets ─────────────────────────────────────────────────────────────────

/**
 * Inserts new tweets and refreshes the metrics of known ones, then re-ranks the
 * affected authors. Tweets by accounts you don't follow are ignored.
 */
export function saveTweets(tweets: IncomingTweet[], observedAt = Date.now()): number {
  const followed = followedAccountIds()
  const relevant = tweets.filter((t) => followed.has(t.authorId))
  if (relevant.length === 0) return 0

  const upsert = getDb().prepare(`
    INSERT INTO tweets (id, author_id, kind, created_at, reply_to_id, reply_to_handle, content,
                        likes, reposts, replies, quotes, bookmarks, views, metrics_at)
    VALUES (:id, :authorId, :kind, :createdAt, :replyToId, :replyToHandle, :content,
            :likes, :reposts, :replies, :quotes, :bookmarks, :views, :metricsAt)
    ON CONFLICT (id) DO UPDATE SET
      likes = excluded.likes, reposts = excluded.reposts, replies = excluded.replies,
      quotes = excluded.quotes, bookmarks = excluded.bookmarks, views = excluded.views,
      metrics_at = excluded.metrics_at,
      -- Keep the reply's parent if this copy of the tweet came without it.
      content = CASE
        WHEN excluded.content ->> '$.parent' IS NOT NULL OR tweets.content ->> '$.parent' IS NULL
        THEN excluded.content ELSE tweets.content END
    WHERE excluded.metrics_at >= tweets.metrics_at
  `)

  transaction(() => {
    for (const t of relevant) {
      upsert.run({
        id: t.id,
        authorId: t.authorId,
        kind: t.kind,
        createdAt: t.createdAt,
        replyToId: t.replyToId,
        replyToHandle: t.replyToHandle,
        content: JSON.stringify(t.content),
        ...t.metrics,
        metricsAt: observedAt,
      })
    }
    rerankAuthors(new Set(relevant.map((t) => t.authorId)))
  })
  return relevant.length
}

export function knownTweetIds(ids: string[]): Set<string> {
  if (ids.length === 0) return new Set()
  const rows = getDb()
    .prepare(`SELECT id FROM tweets WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Row[]
  return new Set(rows.map((r) => r.id as string))
}

/** Re-ranks everyone you follow, so a change to the ranking applies to what's stored. */
export function rerankAll(): void {
  transaction(() => rerankAuthors(followedAccountIds()))
}

function rerankAuthors(authorIds: Set<string>): void {
  const db = getDb()
  const select = db.prepare(`
    SELECT id, kind, created_at, metrics_at, likes, reposts, replies, quotes, bookmarks, views
    FROM tweets WHERE author_id = ? AND created_at >= ?
  `)
  const update = db.prepare("UPDATE tweets SET score = ?, top = ?, kind_top = ? WHERE id = ?")
  // Tweets older than the window keep their last rank; ones that never had one
  // (an old pinned tweet, say) only show when you want everything from the author.
  const fillOld = db.prepare(`
    UPDATE tweets SET top = COALESCE(top, 1), kind_top = COALESCE(kind_top, 1)
    WHERE author_id = ? AND (top IS NULL OR kind_top IS NULL)
  `)
  const windowStart = Date.now() - RANK_WINDOW_MS

  for (const authorId of authorIds) {
    const rows = select.all(authorId, windowStart) as Row[]
    const ranks = rankAuthorTweets(
      rows.map((r) => ({
        id: r.id as string,
        kind: r.kind as TweetKind,
        createdAt: r.created_at as number,
        metricsAt: r.metrics_at as number,
        metrics: {
          likes: r.likes as number,
          reposts: r.reposts as number,
          replies: r.replies as number,
          quotes: r.quotes as number,
          bookmarks: r.bookmarks as number,
          views: r.views as number | null,
        },
      })),
    )
    for (const [id, { score, top, kindTop }] of ranks) update.run(score, top, kindTop, id)
    fillOld.run(authorId)
  }
}

export type FeedFilter = "all" | "posts" | "replies"

/** Reads a feed filter from a URL or request, defaulting to everything. */
export function toFeedFilter(value: unknown): FeedFilter {
  return value === "posts" || value === "replies" ? value : "all"
}

const FEED_SELECT = `
  SELECT t.id, t.kind, t.created_at, t.reply_to_handle, t.content, t.top, t.kind_top,
         t.likes, t.reposts, t.replies, t.quotes, t.bookmarks, t.views,
         a.id AS author_id, a.handle, a.name, a.avatar_url, a.verified
  FROM tweets t JOIN accounts a ON a.id = t.author_id
`

/**
 * What's in your feed: what each account's faders let through (see getsThrough), of
 * the chosen kind. Needs :defaultRatio and :filter.
 */
const IN_FEED = `
  a.following = 1
  AND CASE
    WHEN a.reply_ratio IS NULL THEN t.top <= COALESCE(a.ratio, :defaultRatio)
    WHEN t.kind = 'reply' THEN t.kind_top <= a.reply_ratio
    ELSE t.kind_top <= COALESCE(a.ratio, :defaultRatio)
  END
  AND (:filter = 'all' OR (:filter = 'replies') = (t.kind = 'reply'))
`

/** Your feed, newest first: from each account, only the tweets its ratio lets through. */
export function feedPage({
  cursor,
  limit = 30,
  filter = "all",
}: {
  cursor?: FeedCursor | null
  limit?: number
  filter?: FeedFilter
}): FeedItem[] {
  const rows = getDb()
    .prepare(`
      ${FEED_SELECT}
      WHERE ${IN_FEED}
        AND (:beforeAt IS NULL OR (t.created_at, t.id) < (:beforeAt, :beforeId))
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT :limit
    `)
    .all({
      defaultRatio: getDefaultRatio(),
      filter,
      beforeAt: cursor?.createdAt ?? null,
      beforeId: cursor?.id ?? "",
      limit,
    }) as Row[]
  return rows.map(toFeedItem)
}

/** How many feed tweets are newer than `since` (for the "new posts" pill). */
export function countNewer(since: number, filter: FeedFilter = "all"): number {
  const row = getDb()
    .prepare(`
      SELECT COUNT(*) AS n FROM tweets t JOIN accounts a ON a.id = t.author_id
      WHERE ${IN_FEED} AND t.created_at > :since
    `)
    .get({ since, filter, defaultRatio: getDefaultRatio() }) as Row
  return Number(row.n)
}

/** Tweets synced from accounts you follow, before any fader applies. */
export function countSyncedTweets(): number {
  const row = getDb()
    .prepare(`
      SELECT COUNT(*) AS n FROM tweets t JOIN accounts a ON a.id = t.author_id WHERE a.following = 1
    `)
    .get() as Row
  return Number(row.n)
}

/** One account's recent tweets regardless of its ratio, to preview what a setting lets through. */
export function accountTweets(accountId: string, limit = 60): FeedItem[] {
  const rows = getDb()
    .prepare(`${FEED_SELECT} WHERE a.id = ? ORDER BY t.created_at DESC LIMIT ?`)
    .all(accountId, limit) as Row[]
  return rows.map(toFeedItem)
}

function toFeedItem(row: Row): FeedItem {
  return {
    id: row.id as string,
    kind: row.kind as TweetKind,
    createdAt: row.created_at as number,
    replyToHandle: row.reply_to_handle as string | null,
    content: JSON.parse(row.content as string) as TweetContent,
    top: row.top as number,
    kindTop: row.kind_top as number,
    metrics: {
      likes: row.likes as number,
      reposts: row.reposts as number,
      replies: row.replies as number,
      quotes: row.quotes as number,
      bookmarks: row.bookmarks as number,
      views: row.views as number | null,
    },
    author: {
      id: row.author_id as string,
      handle: row.handle as string,
      name: row.name as string,
      avatarUrl: row.avatar_url as string | null,
      verified: row.verified === 1,
    },
  }
}

function clampRatio(ratio: number): number {
  return Math.min(1, Math.max(0, ratio))
}
