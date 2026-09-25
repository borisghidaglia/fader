import { Tweet } from "rettiwt-api"
import { describe, expect, it } from "vitest"

import fixture from "./__fixtures__/user-tweets.json"
import { toIncomingAccount, toIncomingTweet } from "@/lib/x/normalize"

// A real UserTweets response (@NASA), captured from X's web API.
const timeline = Tweet.timeline(fixture)
const own = timeline.filter((t) => !t.retweetedTweet)

describe("toIncomingTweet", () => {
  it("parses every tweet in a real timeline response", () => {
    expect(own.length).toBeGreaterThan(10)
    for (const tweet of own) {
      const incoming = toIncomingTweet(tweet)
      expect(incoming.authorId).toBe("11348282")
      expect(Number.isFinite(incoming.createdAt)).toBe(true)
      expect(incoming.content.text.length).toBeGreaterThan(0)
      // t.co links are expanded or, for media, removed.
      expect(incoming.content.text).not.toContain("https://t.co/")
      expect(incoming.metrics.likes).toBeGreaterThan(0)
    }
  })

  it("keeps expanded links and their display form", () => {
    const withLink = own.map((t) => toIncomingTweet(t)).find((t) => t.content.links.length > 0)
    expect(withLink).toBeDefined()
    const [link] = withLink!.content.links
    expect(withLink!.content.text).toContain(link.url)
    expect(link.display.length).toBeGreaterThan(0)
  })

  it("uses the full text of long posts", () => {
    // In this fixture the long posts are the originals of reposts.
    const originals = timeline.flatMap((t) => (t.retweetedTweet ? [t.retweetedTweet] : []))
    const long = originals.find((t) => (t.raw as { note_tweet?: unknown }).note_tweet)!
    expect(Array.from(toIncomingTweet(long).content.text).length).toBeGreaterThan(280)
  })

  it("extracts photos with dimensions and videos as mp4", () => {
    const media = own.flatMap((t) => toIncomingTweet(t).content.media)
    const photo = media.find((m) => m.type === "photo")!
    expect(photo.url).toMatch(/^https:\/\/pbs\.twimg\.com\//)
    expect(photo.width).toBeGreaterThan(0)
    const video = media.find((m) => m.type === "video")!
    expect(video.url).toMatch(/\.mp4/)
    expect(video.poster).toMatch(/^https:\/\/pbs\.twimg\.com\//)
  })

  it("classifies posts, and leaves no reply or quote context on them", () => {
    const incoming = toIncomingTweet(own[0])
    expect(incoming.kind).toBe("post")
    expect(incoming.replyToId).toBeNull()
    expect(incoming.content.quoted).toBeNull()
  })
})

describe("toIncomingAccount", () => {
  it("reads the author's profile with a sharper avatar", () => {
    const account = toIncomingAccount(own[0].tweetBy)
    expect(account).toMatchObject({ id: "11348282", handle: "NASA", name: "NASA", protected: false })
    expect(account.avatarUrl).toMatch(/_200x200\.\w+$/)
    expect(account.followersCount).toBeGreaterThan(1_000_000)
  })
})
