import { describe, expect, it } from "vitest"

import { rankAuthorTweets, type Rank, type RankableTweet } from "@/lib/ranking"
import type { Metrics, TweetKind } from "@/lib/types"

const HOUR = 3_600_000
const NOW = Date.UTC(2026, 8, 25)

function tweet(
  id: string,
  likes: number,
  {
    ageHours = 72,
    observedAgeHours = ageHours,
    kind = "post",
  }: { ageHours?: number; observedAgeHours?: number; kind?: TweetKind } = {},
): RankableTweet {
  const metrics: Metrics = { likes, reposts: 0, replies: 0, quotes: 0, bookmarks: 0, views: null }
  const createdAt = NOW - ageHours * HOUR
  return { id, kind, createdAt, metricsAt: createdAt + observedAgeHours * HOUR, metrics }
}

function shownAt(ranks: Map<string, Rank>, ratio: number): string[] {
  return [...ranks].filter(([, rank]) => rank.top <= ratio).map(([id]) => id)
}

describe("rankAuthorTweets", () => {
  const fifty = Array.from({ length: 50 }, (_, i) => tweet(`t${i}`, i * 10))

  it("shows the requested share of an author's tweets, best first", () => {
    const ranks = rankAuthorTweets(fifty)
    expect(shownAt(ranks, 1)).toHaveLength(50)
    expect(shownAt(ranks, 0)).toHaveLength(0)
    expect(shownAt(ranks, 0.1).sort()).toEqual(["t45", "t46", "t47", "t48", "t49"])
    expect(shownAt(ranks, 0.5)).toHaveLength(25)
  })

  it("gives tied tweets the same rank", () => {
    const ranks = rankAuthorTweets([
      tweet("a", 100),
      tweet("b", 0),
      tweet("c", 0),
      tweet("d", 0),
    ])
    expect(ranks.get("b")?.top).toBe(ranks.get("c")?.top)
    expect(ranks.get("c")?.top).toBe(ranks.get("d")?.top)
    expect(shownAt(ranks, 0.25)).toEqual(["a"])
  })

  it("places a brand-new tweet near the author's median, not at the bottom", () => {
    const ranks = rankAuthorTweets([...fifty, tweet("fresh", 0, { ageHours: 0.05 })])
    expect(ranks.get("fresh")?.top).toBeGreaterThan(0.35)
    expect(ranks.get("fresh")?.top).toBeLessThan(0.65)
  })

  it("promotes a young tweet that is taking off", () => {
    // 150 likes after one hour projects well above the author's best (490).
    const ranks = rankAuthorTweets([...fifty, tweet("rocket", 150, { ageHours: 1 })])
    expect(shownAt(ranks, 0.05)).toContain("rocket")
  })

  it("judges stale metrics by the age at which they were observed", () => {
    // Last seen 1 hour after posting with 60 likes: on track for far more, not a 60-like flop.
    const ranks = rankAuthorTweets([
      ...fifty,
      tweet("stale", 60, { ageHours: 200, observedAgeHours: 1 }),
      tweet("flop", 60, { ageHours: 200 }),
    ])
    expect(ranks.get("stale")?.top).toBeLessThan(0.5)
    expect(ranks.get("flop")?.top).toBeGreaterThan(0.8)
  })

  it("takes mature tweets at face value, whatever is typical for their kind", () => {
    const posts = Array.from({ length: 5 }, (_, i) => tweet(`p${i}`, 500 + i))
    const replies = Array.from({ length: 5 }, (_, i) => tweet(`r${i}`, i, { kind: "reply" }))
    const ranks = rankAuthorTweets([
      ...posts,
      ...replies,
      tweet("dud-post", 0),
      tweet("hit-reply", 100, { kind: "reply" }),
    ])
    expect(ranks.get("dud-post")?.score).toBe(0)
    expect(ranks.get("hit-reply")?.score).toBe(100)
    expect(ranks.get("hit-reply")!.top).toBeLessThan(ranks.get("dud-post")!.top)
  })

  it("compares replies against the author's typical reply", () => {
    const posts = Array.from({ length: 10 }, (_, i) => tweet(`p${i}`, 500 + i))
    const replies = Array.from({ length: 10 }, (_, i) => tweet(`r${i}`, i, { kind: "reply" }))
    const fresh = tweet("fresh-reply", 0, { ageHours: 0.05, kind: "reply" })
    const ranks = rankAuthorTweets([...posts, ...replies, fresh])
    // Starts at a typical reply's level (~5 likes), not a typical post's (~500).
    expect(ranks.get("fresh-reply")?.top).toBeGreaterThan(0.5)
  })

  it("also ranks posts against posts and replies against replies, for split faders", () => {
    const posts = Array.from({ length: 10 }, (_, i) => tweet(`p${i}`, 100 + i))
    const replies = Array.from({ length: 10 }, (_, i) => tweet(`r${i}`, i, { kind: "reply" }))
    const ranks = rankAuthorTweets([...posts, ...replies])
    // Their best reply trails every post, but it's the best of their replies.
    expect(ranks.get("r9")!.top).toBeGreaterThan(0.5)
    expect(ranks.get("r9")!.kindTop).toBe(0.05)
    expect(ranks.get("p9")!.kindTop).toBe(0.05)
    expect(ranks.get("p0")!.kindTop).toBe(0.95)
  })
})
