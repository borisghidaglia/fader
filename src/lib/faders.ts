import type { TweetKind } from "@/lib/types"

// The feed's rule, shared by the store (which applies it in SQL, see IN_FEED) and
// the pages (which preview it while you drag a fader).

/** An account's own settings. Both null: it goes with the default. */
export type Faders = {
  /** Its fader: for everything it says, or only its posts when replies have their own. Null = the default. */
  ratio: number | null
  /** Its replies' own fader. Null = one fader for posts and replies alike. */
  replyRatio: number | null
}

/** Where an account's faders sit, with the default filled in. */
export type Levels = { split: boolean; posts: number; replies: number }

export function levels({ ratio, replyRatio }: Faders, defaultRatio: number): Levels {
  const posts = ratio ?? defaultRatio
  return { split: replyRatio !== null, posts, replies: replyRatio ?? posts }
}

/**
 * Whether a tweet reaches the feed. One fader goes by the tweet's rank among
 * everything the author said; split faders go by its rank among their posts
 * or among their replies.
 */
export function getsThrough(
  tweet: { kind: TweetKind; top: number; kindTop: number },
  faders: Faders,
  defaultRatio: number,
): boolean {
  const { split, posts, replies } = levels(faders, defaultRatio)
  if (!split) return tweet.top <= posts
  return tweet.kindTop <= (tweet.kind === "reply" ? replies : posts)
}

/** Roughly how many of an account's tweets a day reach the feed. */
export function shownPerDay(
  pace: { perDay: number; repliesPerDay: number },
  faders: Faders,
  defaultRatio: number,
): number {
  const { split, posts, replies } = levels(faders, defaultRatio)
  if (!split) return pace.perDay * posts
  return (pace.perDay - pace.repliesPerDay) * posts + pace.repliesPerDay * replies
}

/** Nothing gets through, so there's no point reading the account. */
export function isMuted(faders: Faders, defaultRatio: number): boolean {
  const { posts, replies } = levels(faders, defaultRatio)
  return posts === 0 && replies === 0
}

/**
 * An account's faders with its replies split off (`split`) or folded back in, set from
 * its recent `tweets` to let through what got through before. Split, each fader starts
 * at the share of its kind that was getting through, which is exactly the same tweets.
 * Joined, the one fader takes the share of everything, so as many get through.
 */
export function refit(
  faders: Faders,
  split: boolean,
  tweets: { kind: TweetKind; top: number; kindTop: number }[],
  defaultRatio: number,
): Faders {
  const { replies } = levels(faders, defaultRatio)
  if (split === (faders.replyRatio !== null)) return faders
  const shareThrough = <T>(of: typeof tweets, otherwise: T) =>
    of.length === 0 ? otherwise : of.filter((t) => getsThrough(t, faders, defaultRatio)).length / of.length
  if (!split) return { ratio: shareThrough(tweets, faders.ratio), replyRatio: null }
  return {
    ratio: shareThrough(tweets.filter((t) => t.kind !== "reply"), faders.ratio),
    replyRatio: shareThrough(tweets.filter((t) => t.kind === "reply"), replies),
  }
}

/** Whether the account has a setting of its own. */
export function isTuned({ ratio, replyRatio }: Faders): boolean {
  return ratio !== null || replyRatio !== null
}
