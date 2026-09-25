import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { Tweet } from "rettiwt-api"
import { beforeAll, describe, expect, it } from "vitest"

import fixture from "./x/__fixtures__/user-tweets.json"
import { RateLimitedError, type XClient } from "@/lib/x/client"
import { toIncomingTweets, type IncomingAccount } from "@/lib/x/normalize"

// Real code against a throwaway database, with X replaced by the NASA fixture.
process.env.FEED_DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "feed-test-")), "feed.db")
const store = await import("@/lib/store")
const { syncAccount, syncFeed, syncFollowing } = await import("@/lib/sync")

const NASA = "11348282"
/** Tweet ids for made-up tweets, newer than any real one in the fixture. */
const LATEST = BigInt("4611686018427387904")
const pageOfTweets = Tweet.timeline(fixture)
const ownTweets = pageOfTweets.filter((t) => !t.retweetedTweet)

/** A made-up tweet (by "someone" unless said otherwise), built on a real one. */
function madeUp(
  id: bigint,
  hoursAgo: number,
  links: { authorId?: string; replyTo?: string; conversationId?: string } = {},
): Tweet {
  const [base] = ownTweets
  return Object.assign(Object.create(Object.getPrototypeOf(base)), base, {
    id: String(id),
    createdAt: new Date(Date.now() - hoursAgo * 3_600_000).toUTCString(),
    replyTo: links.replyTo,
    conversationId: links.conversationId ?? String(id),
    tweetBy: { ...base.tweetBy, id: links.authorId ?? "2", pinnedTweets: [] },
  })
}

const account = (id: string, handle: string): IncomingAccount => ({
  id,
  handle,
  name: handle,
  avatarUrl: null,
  bio: null,
  followersCount: 1,
  verified: false,
  protected: false,
})

const timelineCalls: (string | undefined)[] = []
const fakeX = {
  viewerId: "1",
  waitFor: () => 0,
  following: async (cursor?: string) =>
    cursor
      ? { accounts: [account("2", "someone")], next: null }
      : { accounts: [account(NASA, "NASA")], next: "page-2" },
  homeFeed: async () => ({ tweets: pageOfTweets.slice(0, 8), next: "older" }),
  timeline: async (_userId: string, cursor?: string) => {
    timelineCalls.push(cursor)
    return { tweets: pageOfTweets, next: "older" }
  },
} as unknown as XClient

beforeAll(async () => {
  await syncFollowing(fakeX)
})

describe("sync", () => {
  it("saves the following list in order", () => {
    const accounts = store.listAccounts()
    expect(accounts.map((a) => [a.handle, a.followOrder])).toEqual([
      ["NASA", 0],
      ["someone", 1],
    ])
  })

  it("saves new posts from the Following tab, skipping reposts", async () => {
    await syncFeed(fakeX)
    const feed = store.feedPage({})
    const expected = pageOfTweets.slice(0, 8).filter((t) => !t.retweetedTweet)
    expect(feed.map((t) => t.id).sort()).toEqual(expected.map((t) => t.id).sort())
    expect(feed[0].author.handle).toBe("NASA")
  })

  it("keeps paging the Following tab past repeated context, until pages are mostly known", async () => {
    // The previous test saved ownTweets' first posts; pages 1 and 2 are mostly new
    // (page 1 repeats one known tweet), page 3 is all known.
    const known = pageOfTweets.slice(0, 8).filter((t) => !t.retweetedTweet)
    const fresh = ownTweets.filter((t) => !known.includes(t))
    const pages = [[known[0], ...fresh.slice(0, 4)], fresh.slice(4, 8), known]
    const cursors: (string | undefined)[] = []
    const pagingX = {
      ...fakeX,
      homeFeed: async (cursor?: string) => {
        cursors.push(cursor)
        return { tweets: pages[cursors.length - 1] ?? [], next: `page-${cursors.length + 1}` }
      },
    } as unknown as XClient

    await syncFeed(pagingX)
    expect(cursors).toEqual([undefined, "page-2", "page-3"])
  })

  it("pages an account's history on first sync, then stops at known tweets", async () => {
    const [target] = store.dueAccounts(Date.now(), 10).filter((t) => t.id === NASA)
    await syncAccount(fakeX, target)
    expect(timelineCalls).toEqual([undefined, "older"]) // two pages of history

    timelineCalls.length = 0
    const [again] = store.dueAccounts(Infinity, 10).filter((t) => t.id === NASA)
    expect(again.newestSeenId).toBe(ownTweets.map((t) => BigInt(t.id)).sort().at(-1)!.toString())
    await syncAccount(fakeX, again)
    expect(timelineCalls).toEqual([undefined]) // first page already overlaps
  })

  it("filters each account's tweets by its ratio", () => {
    const all = store.feedPage({ limit: 100 })
    expect(all).toHaveLength(ownTweets.length)

    store.setAccountFaders(NASA, { ratio: 0.25, replyRatio: null })
    const top = store.feedPage({ limit: 100 })
    expect(top).toHaveLength(Math.round(ownTweets.length * 0.25))
    const bestLikes = Math.max(...ownTweets.map((t) => t.likeCount ?? 0))
    expect(top.some((t) => t.metrics.likes === bestLikes)).toBe(true)

    store.setAccountFaders(NASA, { ratio: 0, replyRatio: null })
    expect(store.feedPage({ limit: 100 })).toHaveLength(0)
    expect(store.dueAccounts(Infinity, 10).map((t) => t.id)).not.toContain(NASA)

    store.setAccountFaders(NASA, { ratio: null, replyRatio: null })
    store.setDefaultRatio(0.5)
    expect(store.feedPage({ limit: 100 })).toHaveLength(Math.round(ownTweets.length * 0.5))
    store.setDefaultRatio(1)
  })

  it("paginates the feed with a cursor", () => {
    const first = store.feedPage({ limit: 5 })
    const last = first.at(-1)!
    const second = store.feedPage({ limit: 5, cursor: { createdAt: last.createdAt, id: last.id } })
    expect(second).toHaveLength(5)
    expect(second[0].createdAt).toBeLessThanOrEqual(last.createdAt)
    expect(new Set([...first, ...second].map((t) => t.id)).size).toBe(10)
  })

  it("measures activity over the stretch of timeline it has read", async () => {
    // Someone prolific, posting every 3 hours: a first sync's two pages reach 60 hours back.
    const page = (from: number) =>
      Array.from({ length: 10 }, (_, i) => madeUp(LATEST - BigInt(from + i), (from + i + 1) * 3))
    const busyX = {
      ...fakeX,
      timeline: async (_userId: string, cursor?: string) => ({ tweets: page(cursor ? 10 : 0), next: "older" }),
    } as unknown as XClient
    const perDay = () => store.listAccounts().find((a) => a.id === "2")!.perDay

    const [first] = store.dueAccounts(Infinity, 10).filter((t) => t.id === "2")
    await syncAccount(busyX, first)
    expect(perDay()).toBeCloseTo(20 / 2.5, 1) // not 20 / 7

    // Catching up to known tweets keeps what was read before.
    const [again] = store.dueAccounts(Infinity, 10).filter((t) => t.id === "2")
    await syncAccount(busyX, again)
    expect(perDay()).toBeCloseTo(20 / 2.5, 1)
  })

  it("keeps catching up past old posts shown as context for new replies", async () => {
    // Page 1 has new replies in two of their months-old threads: one right under the
    // post it answers, one below a collapsed thread. Neither old post is a sign we've
    // reached what the last sync read (the previous test's newest tweet): page 3 is.
    const known = LATEST
    const at = (n: number) => known + BigInt(n)
    const answered = madeUp(at(-1000), 2000)
    const threadStart = madeUp(at(-2000), 3000)
    const pages = [
      [
        answered,
        madeUp(at(4), 1, { replyTo: answered.id, conversationId: answered.id }),
        threadStart,
        madeUp(at(3), 1, { replyTo: String(at(-1500)), conversationId: threadStart.id }),
      ],
      [madeUp(at(2), 2)],
      [madeUp(at(1), 3), madeUp(known, 4)],
    ]
    const cursors: (string | undefined)[] = []
    const catchUpX = {
      ...fakeX,
      timeline: async (_userId: string, cursor?: string) => {
        cursors.push(cursor)
        return { tweets: pages[cursors.length - 1] ?? [], next: `page-${cursors.length + 1}` }
      },
    } as unknown as XClient

    const [target] = store.dueAccounts(Infinity, 10).filter((t) => t.id === "2")
    expect(target.newestSeenId).toBe(known.toString())
    await syncAccount(catchUpX, target)
    expect(cursors).toEqual([undefined, "page-2", "page-3"])
  })

  it("reads past Following tab pages of new replies under posts it already has", async () => {
    // Page 1 is new replies, each shown under an older post that's already saved. The
    // saved posts are context, so the page counts as all new; page 3 is what's known.
    const tweet = (n: number, hoursAgo: number, answering?: Tweet) =>
      madeUp(LATEST + BigInt(1_000_000 + n), hoursAgo, {
        authorId: NASA,
        replyTo: answering?.id,
        conversationId: answering?.id,
      })
    const parents = [tweet(0, 50), tweet(1, 50)]
    store.saveTweets(toIncomingTweets(parents))
    const pages = [
      [parents[0], tweet(10, 1, parents[0]), parents[1], tweet(11, 1, parents[1])],
      [tweet(9, 2), tweet(8, 2)],
      parents,
    ]
    const cursors: (string | undefined)[] = []
    const pagingX = {
      ...fakeX,
      homeFeed: async (cursor?: string) => {
        cursors.push(cursor)
        return { tweets: pages[cursors.length - 1] ?? [], next: `page-${cursors.length + 1}` }
      },
    } as unknown as XClient

    await syncFeed(pagingX)
    expect(cursors).toEqual([undefined, "page-2", "page-3"])
  })

  it("keeps what it read when requests run out partway through an account", async () => {
    // Page 1 is all new; page 2 would exceed the budget. Page 1 shouldn't be read
    // again as soon as there's room: the account is read for now.
    const newest = LATEST + BigInt(2_000_000)
    const calls: (string | undefined)[] = []
    const limitedX = {
      ...fakeX,
      timeline: async (_userId: string, cursor?: string) => {
        calls.push(cursor)
        if (cursor) throw new RateLimitedError("UserTweetsAndReplies", Date.now() + 5_000)
        return { tweets: [madeUp(newest, 1), madeUp(newest - BigInt(1), 2)], next: "page-2" }
      },
    } as unknown as XClient

    const [target] = store.dueAccounts(Infinity, 10).filter((t) => t.id === "2")
    expect(await syncAccount(limitedX, target)).toBeNull()
    expect(calls).toEqual([undefined, "page-2"])
    expect(store.dueAccounts(Date.now(), 10).map((t) => t.id)).not.toContain("2")
    const [after] = store.dueAccounts(Infinity, 10).filter((t) => t.id === "2")
    expect(after.newestSeenId).toBe(newest.toString())
  })

  it("gives replies a fader of their own", () => {
    const fromNasa = () => store.feedPage({ limit: 500 }).filter((t) => t.author.id === NASA)
    const everything = fromNasa()
    const replies = everything.filter((t) => t.kind === "reply")
    expect(replies.length).toBeGreaterThan(0)

    store.setAccountFaders(NASA, { ratio: 1, replyRatio: 0 })
    expect(fromNasa()).toHaveLength(everything.length - replies.length)
    expect(fromNasa().some((t) => t.kind === "reply")).toBe(false)

    store.setAccountFaders(NASA, { ratio: 0, replyRatio: 1 })
    expect(fromNasa().map((t) => t.id)).toEqual(replies.map((t) => t.id))
    // Its replies still get through, so the account is still read.
    expect(store.dueAccounts(Infinity, 10).map((t) => t.id)).toContain(NASA)

    store.setAccountFaders(NASA, { ratio: 0, replyRatio: 0 })
    expect(store.dueAccounts(Infinity, 10).map((t) => t.id)).not.toContain(NASA)
    store.setAccountFaders(NASA, { ratio: null, replyRatio: null })
  })

  it("saves one fader without touching the other", () => {
    const nasa = () => store.listAccounts().find((a) => a.id === NASA)!
    store.setAccountFaders(NASA, { ratio: 0.2, replyRatio: 0.7 })
    store.setAccountFaders(NASA, { ratio: 0.5 })
    expect(nasa()).toMatchObject({ ratio: 0.5, replyRatio: 0.7 })
    store.setAccountFaders(NASA, { replyRatio: 0.1 })
    expect(nasa()).toMatchObject({ ratio: 0.5, replyRatio: 0.1 })
    store.setAccountFaders(NASA, { ratio: null, replyRatio: null })
  })

  it("keeps the feed as it was when replies get their own fader", () => {
    const fromNasa = () => store.feedPage({ limit: 500 }).filter((t) => t.author.id === NASA).map((t) => t.id)
    store.setAccountFaders(NASA, { ratio: 0.4 })
    const before = fromNasa()
    expect(before.length).toBeGreaterThan(0)
    expect(store.setAccountSplit(NASA, true).replyRatio).not.toBeNull()
    expect(fromNasa()).toEqual(before)
    expect(store.setAccountSplit(NASA, false).replyRatio).toBeNull()
    expect(fromNasa()).toHaveLength(before.length)
    store.setAccountFaders(NASA, { ratio: null, replyRatio: null })
  })

  it("marks accounts you unfollowed", () => {
    store.markUnfollowedExcept([NASA])
    expect(store.listAccounts().map((a) => a.handle)).toEqual(["NASA"])
  })
})
