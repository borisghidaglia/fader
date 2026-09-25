import type { Metrics, TweetKind } from "@/lib/types"

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Only an author's output from this recent window is ranked against each other. */
export const RANK_WINDOW_MS = 30 * DAY

/**
 * Engagement follows a saturating curve: a post collects ~63% of its lifetime
 * engagement in its first 6 hours and ~98% within a day.
 */
const ENGAGEMENT_TIME_CONSTANT_MS = 6 * HOUR

/** Past this age a post is treated as done collecting engagement. */
const MATURE_AGE_MS = 2 * DAY

/** How much a young post's estimate leans on the author's typical result. */
const PRIOR_WEIGHT = 0.25

/** Fewest mature posts (or replies) needed to trust their median as "typical". */
const MIN_TYPICAL_SAMPLES = 3

export type RankableTweet = {
  id: string
  kind: TweetKind
  createdAt: number
  /** When `metrics` were observed. Metrics go stale once a tweet drops off the timelines we poll. */
  metricsAt: number
  metrics: Metrics
}

export function engagement(m: Metrics): number {
  return m.likes + 2 * m.reposts + 2 * m.quotes + m.replies + m.bookmarks
}

/** Share of its lifetime engagement a post has typically collected at `ageMs`. */
export function maturity(ageMs: number): number {
  if (ageMs >= MATURE_AGE_MS) return 1
  return 1 - Math.exp(-Math.max(ageMs, 0) / ENGAGEMENT_TIME_CONSTANT_MS)
}

/**
 * Estimated lifetime engagement. Mature posts are taken at face value. Young ones are
 * extrapolated from their early numbers, shrunk towards `typical` (the author's median)
 * so that 2 likes after 3 minutes doesn't outrank everything the author ever wrote.
 * The shrinking fades as the post matures.
 */
export function projectedEngagement(observed: number, maturity: number, typical: number): number {
  const prior = PRIOR_WEIGHT * (1 - maturity)
  return (observed + prior * typical) / (maturity + prior)
}

export type Rank = {
  /** Projected lifetime engagement. */
  score: number
  /**
   * Position in the author's ranking as a fraction: 0 is their best, 1 their worst.
   * Under one fader a tweet is shown when `top <= ratio`, so ratio 0.1 shows the
   * author's best ~10% and ratio 1 shows everything.
   */
  top: number
  /**
   * The same, among only the author's posts (quotes included) or only their replies.
   * An account whose replies have their own fader is filtered on this instead.
   */
  kindTop: number
}

/** Ranks one author's tweets against each other, and against the others of their kind. */
export function rankAuthorTweets(tweets: RankableTweet[]): Map<string, Rank> {
  const typical = typicalEngagement(tweets)
  const scored = tweets.map((t) => ({
    id: t.id,
    reply: t.kind === "reply",
    score: projectedEngagement(
      engagement(t.metrics),
      maturity(t.metricsAt - t.createdAt),
      typical(t.kind),
    ),
  }))
  scored.sort((a, b) => b.score - a.score)

  const top = positions(scored)
  const kindTop = new Map([
    ...positions(scored.filter((t) => !t.reply)),
    ...positions(scored.filter((t) => t.reply)),
  ])
  return new Map(scored.map((t) => [t.id, { score: t.score, top: top.get(t.id)!, kindTop: kindTop.get(t.id)! }]))
}

/** Each tweet's position in a list sorted best first, as a fraction: 0 is the best, 1 the worst. */
function positions(sorted: { id: string; score: number }[]): Map<string, number> {
  const tops = new Map<string, number>()
  const n = sorted.length
  for (let start = 0; start < n; ) {
    // Tied tweets share the average of their positions, so a slider setting
    // shows all or none of a tie rather than an arbitrary subset.
    let end = start
    while (end + 1 < n && sorted[end + 1].score === sorted[start].score) end++
    const top = ((start + end) / 2 + 0.5) / n
    for (let i = start; i <= end; i++) tops.set(sorted[i].id, top)
    start = end + 1
  }
  return tops
}

/**
 * The author's median lifetime engagement, computed separately for replies and
 * posts because replies usually get far less.
 */
function typicalEngagement(tweets: RankableTweet[]): (kind: TweetKind) => number {
  const mature = tweets.filter((t) => t.metricsAt - t.createdAt >= MATURE_AGE_MS)
  const of = (list: RankableTweet[]) => list.map((t) => engagement(t.metrics))

  const overall =
    median(of(mature), 1) ?? median(of(tweets), 1) ?? 0
  const replies = median(of(mature.filter((t) => t.kind === "reply")), MIN_TYPICAL_SAMPLES)
  const posts = median(of(mature.filter((t) => t.kind !== "reply")), MIN_TYPICAL_SAMPLES)

  return (kind) => (kind === "reply" ? replies : posts) ?? overall
}

function median(values: number[], minCount: number): number | null {
  if (values.length < minCount || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
