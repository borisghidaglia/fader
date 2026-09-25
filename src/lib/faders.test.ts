import { describe, expect, it } from "vitest"

import { getsThrough, isMuted, isTuned, refit, shownPerDay, type Faders } from "@/lib/faders"
import { rankAuthorTweets } from "@/lib/ranking"
import type { TweetKind } from "@/lib/types"

/** A month of an author's tweets, best first: "p" a post, "r" a reply. An "=" in `ties` ties that one with the one before. */
function month(kinds: string, ties = "") {
  const now = Date.UTC(2026, 8, 25)
  const tweets = [...kinds].map((k, i) => ({
    id: String(i),
    kind: (k === "r" ? "reply" : "post") as TweetKind,
    createdAt: now - 72 * 3_600_000,
    metricsAt: now,
    metrics: { likes: 100 - (ties[i] === "=" ? i - 1 : i), reposts: 0, replies: 0, quotes: 0, bookmarks: 0, views: null },
  }))
  const ranks = rankAuthorTweets(tweets)
  return tweets.map((t) => ({ id: t.id, kind: t.kind, ...ranks.get(t.id)! }))
}

const post = { kind: "post", top: 0.3, kindTop: 0.1 } as const
const reply = { kind: "reply", top: 0.9, kindTop: 0.2 } as const

describe("faders", () => {
  it("ranks everything together under one fader", () => {
    const one = { ratio: 0.5, replyRatio: null }
    expect(getsThrough(post, one, 1)).toBe(true)
    expect(getsThrough(reply, one, 1)).toBe(false)
  })

  it("ranks posts and replies apart once replies have their own fader", () => {
    const split = { ratio: 0.05, replyRatio: 0.25 }
    expect(getsThrough(post, split, 1)).toBe(false)
    expect(getsThrough(reply, split, 1)).toBe(true)
  })

  it("keeps the posts fader on the default until it's moved", () => {
    const repliesOnly = { ratio: null, replyRatio: 0 }
    expect(getsThrough(post, repliesOnly, 0.1)).toBe(true)
    expect(getsThrough(reply, repliesOnly, 0.1)).toBe(false)
    expect(isTuned(repliesOnly)).toBe(true)
    expect(isTuned({ ratio: null, replyRatio: null })).toBe(false)
  })

  it("counts what gets through a day", () => {
    const pace = { perDay: 30, repliesPerDay: 20 }
    expect(shownPerDay(pace, { ratio: 0.5, replyRatio: null }, 1)).toBe(15)
    expect(shownPerDay(pace, { ratio: 1, replyRatio: 0.1 }, 1)).toBe(12)
  })

  it("mutes an account only when both faders are down", () => {
    expect(isMuted({ ratio: 0, replyRatio: null }, 1)).toBe(true)
    expect(isMuted({ ratio: 0, replyRatio: 0.2 }, 1)).toBe(false)
    expect(isMuted({ ratio: null, replyRatio: 0 }, 0)).toBe(true)
  })

  it("splits and joins an account's fader without changing what gets through", () => {
    const tweets = month("pprpprrprrrrpprrrpr", "      =     =     ")
    const through = (faders: Faders) => tweets.filter((t) => getsThrough(t, faders, 0.4)).map((t) => t.id)

    for (const ratio of [0, 0.05, 0.3, null, 0.5, 0.77, 1]) {
      const one = { ratio, replyRatio: null }
      const split = refit(one, true, tweets, 0.4)
      expect(split.replyRatio).not.toBeNull()
      expect(through(split)).toEqual(through(one))
      // Back to one fader: as many get through.
      expect(through(refit(split, false, tweets, 0.4))).toHaveLength(through(one).length)
    }
  })

  it("leaves an account with nothing read on the default", () => {
    expect(refit({ ratio: null, replyRatio: null }, true, [], 0.4)).toEqual({ ratio: null, replyRatio: 0.4 })
    expect(refit({ ratio: null, replyRatio: 0.1 }, false, [], 0.4)).toEqual({ ratio: null, replyRatio: null })
  })
})
