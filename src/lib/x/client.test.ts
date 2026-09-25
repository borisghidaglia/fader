import { describe, expect, it } from "vitest"

import { XClient } from "@/lib/x/client"

const MINUTE = 60_000

describe("XClient pacing", () => {
  it("keeps to its own budget, with room left for the Following tab", () => {
    const x = new XClient({ authToken: "token", ct0: "csrf", twid: "u%3D1" })
    const sent = (x as unknown as { sent: number[] }).sent
    const now = Date.now()

    // 35 requests a minute ago: timelines have used their share of the budget...
    for (let i = 0; i < 35; i++) sent.push(now - MINUTE + i)
    expect(x.waitFor("UserTweetsAndReplies", now)).toBeGreaterThan(13 * MINUTE)
    expect(x.waitFor("Following", now)).toBeGreaterThan(13 * MINUTE)
    // ...but the Following tab can still be checked.
    expect(x.waitFor("HomeLatestTimeline", now)).toBe(0)

    for (let i = 0; i < 5; i++) sent.push(now)
    expect(x.waitFor("HomeLatestTimeline", now)).toBeGreaterThan(0)

    // Room for one more isn't room for two.
    sent.length = 0
    for (let i = 0; i < 34; i++) sent.push(now - MINUTE + i)
    expect(x.waitFor("UserTweetsAndReplies", now)).toBe(0)
    expect(x.waitFor("UserTweetsAndReplies", now, 2)).toBeGreaterThan(13 * MINUTE)
    for (let i = 0; i < 6; i++) sent.push(now)

    // Once they're 15 minutes old, everything is open again.
    expect(x.waitFor("UserTweetsAndReplies", now + 15 * MINUTE)).toBe(0)
  })
})
