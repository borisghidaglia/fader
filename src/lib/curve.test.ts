import { describe, expect, it } from "vitest"

import { engagementCurve } from "@/lib/curve"
import { rankAuthorTweets, type RankableTweet } from "@/lib/ranking"

const DAY = 86_400_000

function mature(id: string, likes: number): RankableTweet {
  const metrics = { likes, reposts: 0, replies: 0, quotes: 0, bookmarks: 0, views: null }
  return { id, kind: "post", createdAt: 0, metricsAt: 3 * DAY, metrics }
}

describe("engagementCurve", () => {
  it("lights exactly the bars the feed lets through, ties included", () => {
    const likes = [100, 50, 10, 10, 0, 0, 0, 0, 0, 0]
    const ranked = [...rankAuthorTweets(likes.map((n, i) => mature(`t${i}`, n))).values()]
      .sort((a, b) => a.top - b.top)
    const bars = engagementCurve(ranked)
    expect(bars).toHaveLength(likes.length)

    for (const ratio of [0, 0.1, 0.3, 0.4, 0.5, 0.7, 1]) {
      const lit = bars.filter((bar) => bar.top <= ratio).length
      const shown = ranked.filter((rank) => rank.top <= ratio).length
      expect(lit, `at ${ratio}`).toBe(shown)
    }
  })

  it("draws the best tweet full height and buckets busy accounts", () => {
    const ranked = [...rankAuthorTweets(Array.from({ length: 100 }, (_, i) => mature(`t${i}`, 100 - i))).values()]
      .sort((a, b) => a.top - b.top)
    const bars = engagementCurve(ranked)
    expect(bars).toHaveLength(40)
    expect(bars[0].height).toBeGreaterThan(0.95)
    expect(bars.at(-1)!.height).toBeLessThan(bars[0].height)
  })
})
