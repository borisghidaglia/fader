import type { Bar } from "@/lib/curve"

export type TweetKind = "post" | "quote" | "reply"

export type Metrics = {
  likes: number
  reposts: number
  replies: number
  quotes: number
  bookmarks: number
  views: number | null
}

export type Media = {
  type: "photo" | "video" | "gif"
  /** Full-size image, or the mp4 file for videos and GIFs. */
  url: string
  /** Still image: the photo itself, or the video's thumbnail. */
  poster: string
  width: number
  height: number
  alt: string | null
}

/** Maps an expanded URL in the text to the short form X displays for it. */
export type Link = { url: string; display: string }

export type EmbeddedTweet = {
  id: string
  author: { handle: string; name: string; avatarUrl: string | null }
  createdAt: number
  text: string
  links: Link[]
  media: Media[]
}

/** Everything needed to render a tweet, stored as JSON. */
export type TweetContent = {
  text: string
  links: Link[]
  media: Media[]
  quoted: EmbeddedTweet | null
  /** The tweet being replied to, when X sent it along. */
  parent: EmbeddedTweet | null
}

export type FeedItem = {
  id: string
  kind: TweetKind
  createdAt: number
  replyToHandle: string | null
  content: TweetContent
  metrics: Metrics
  /** Rank within the author's recent output: 0 = their best, 1 = their worst. */
  top: number
  author: {
    id: string
    handle: string
    name: string
    avatarUrl: string | null
    verified: boolean
  }
}

export type FeedCursor = { createdAt: number; id: string }

export type Account = {
  id: string
  handle: string
  name: string
  avatarUrl: string | null
  bio: string | null
  followersCount: number
  verified: boolean
  protected: boolean
  followOrder: number | null
  /** The account's own setting, or null when it uses the default. */
  ratio: number | null
  lastSyncedAt: number | null
  lastError: string | null
  /** Posts + replies per day over the last week (or as much of it as has been read). */
  perDay: number
  /** Their recent tweets ranked best first, as fader track bars. */
  curve: Bar[]
}

export type SyncStatus = {
  state: "idle" | "syncing" | "waiting" | "error"
  message: string
  /** Last time the worker was alive; stale means it isn't running. */
  heartbeatAt: number
  lastFeedSyncAt: number | null
  lastFollowingSyncAt: number | null
  accountsSynced: number
  accountsTotal: number
  rateLimitedUntil: number | null
  error: string | null
}
