import type { Tweet, User } from "rettiwt-api"

import type {
  EmbeddedTweet,
  Link,
  Media,
  Metrics,
  TweetContent,
  TweetKind,
} from "@/lib/types"

/** A tweet as the sync stores it. */
export type IncomingTweet = {
  id: string
  authorId: string
  kind: TweetKind
  createdAt: number
  replyToId: string | null
  replyToHandle: string | null
  content: TweetContent
  metrics: Metrics
}

export type IncomingAccount = {
  id: string
  handle: string
  name: string
  avatarUrl: string | null
  bio: string | null
  followersCount: number
  verified: boolean
  protected: boolean
}

// The subset of X's raw tweet JSON we read. rettiwt's own raw types omit several
// fields that X does send (sizes, alt text, reply handle), so everything is optional.
type RawUrl = { url: string; expanded_url?: string; display_url?: string }
type RawMedia = {
  type: "photo" | "video" | "animated_gif"
  url: string
  media_url_https: string
  ext_alt_text?: string | null
  original_info?: { width?: number; height?: number }
  video_info?: { variants?: { bitrate?: number; content_type: string; url: string }[] }
}
type RawTweet = {
  note_tweet?: { note_tweet_results?: { result?: { text?: string; entity_set?: { urls?: RawUrl[] } } } }
  legacy?: {
    full_text?: string
    display_text_range?: [number, number]
    in_reply_to_screen_name?: string
    entities?: { urls?: RawUrl[]; media?: { url: string }[] }
    extended_entities?: { media?: RawMedia[] }
  }
}

/**
 * Converts one page of a timeline. Reposts are dropped: the feed is about what
 * people write. Replies get their parent attached when X sent it along, which it
 * does for most replies on "tweets & replies" timelines.
 */
export function toIncomingTweets(tweets: Tweet[]): IncomingTweet[] {
  const byId = new Map(tweets.map((t) => [t.id, t]))
  return tweets
    .filter((t) => !t.retweetedTweet)
    .map((t) => toIncomingTweet(t, t.replyTo ? byId.get(t.replyTo) : undefined))
}

export function toIncomingTweet(tweet: Tweet, parent?: Tweet): IncomingTweet {
  const raw = tweet.raw as unknown as RawTweet
  const kind: TweetKind = tweet.replyTo ? "reply" : tweet.quoted ? "quote" : "post"
  return {
    id: tweet.id,
    authorId: tweet.tweetBy.id,
    kind,
    createdAt: Date.parse(tweet.createdAt),
    replyToId: tweet.replyTo ?? null,
    replyToHandle: raw.legacy?.in_reply_to_screen_name ?? null,
    content: {
      ...textAndMedia(tweet),
      quoted: tweet.quoted ? toEmbedded(tweet.quoted) : null,
      parent: parent ? toEmbedded(parent) : null,
    },
    metrics: {
      likes: tweet.likeCount ?? 0,
      reposts: tweet.retweetCount ?? 0,
      replies: tweet.replyCount ?? 0,
      quotes: tweet.quoteCount ?? 0,
      bookmarks: tweet.bookmarkCount ?? 0,
      views: tweet.viewCount ?? null,
    },
  }
}

export function toIncomingAccount(user: User): IncomingAccount {
  const raw = user.raw as unknown as { privacy?: { protected?: boolean }; legacy?: { protected?: boolean } }
  return {
    id: user.id,
    handle: user.userName,
    name: user.fullName,
    avatarUrl: user.profileImage ? largerAvatar(user.profileImage) : null,
    bio: user.description ?? null,
    followersCount: user.followersCount ?? 0,
    verified: Boolean(user.isVerified),
    protected: Boolean(raw.privacy?.protected ?? raw.legacy?.protected),
  }
}

function toEmbedded(tweet: Tweet): EmbeddedTweet {
  return {
    id: tweet.id,
    author: {
      handle: tweet.tweetBy.userName,
      name: tweet.tweetBy.fullName,
      avatarUrl: tweet.tweetBy.profileImage ? largerAvatar(tweet.tweetBy.profileImage) : null,
    },
    createdAt: Date.parse(tweet.createdAt),
    ...textAndMedia(tweet),
  }
}

function textAndMedia(tweet: Tweet): { text: string; links: Link[]; media: Media[] } {
  const raw = tweet.raw as unknown as RawTweet
  const note = raw.note_tweet?.note_tweet_results?.result
  const legacy = raw.legacy ?? {}

  let text: string
  let urls: RawUrl[]
  if (note?.text) {
    // Long posts: the full text lives in the note, legacy.full_text is truncated.
    text = note.text
    urls = note.entity_set?.urls ?? []
  } else {
    // display_text_range hides the leading @mentions of a reply and the trailing
    // media link. Its indices count code points, not UTF-16 units.
    const chars = Array.from(legacy.full_text ?? "")
    const [start, end] = legacy.display_text_range ?? [0, chars.length]
    text = chars.slice(start, end).join("")
    urls = legacy.entities?.urls ?? []
  }

  const links: Link[] = []
  for (const u of urls) {
    const expanded = u.expanded_url ?? u.url
    // The link to a quoted tweet is redundant with the embedded quote.
    const isQuoteLink = tweet.quoted && expanded.includes(`/status/${tweet.quoted.id}`)
    text = text.replaceAll(u.url, isQuoteLink ? "" : expanded)
    if (!isQuoteLink) links.push({ url: expanded, display: u.display_url ?? expanded })
  }
  for (const m of legacy.entities?.media ?? []) text = text.replaceAll(m.url, "")

  return {
    text: decodeEntities(text).trim(),
    links,
    media: (legacy.extended_entities?.media ?? []).map(toMedia),
  }
}

function toMedia(m: RawMedia): Media {
  const width = m.original_info?.width ?? 0
  const height = m.original_info?.height ?? 0
  const alt = m.ext_alt_text || null
  if (m.type === "photo") {
    return { type: "photo", url: m.media_url_https, poster: m.media_url_https, width, height, alt }
  }
  const best = (m.video_info?.variants ?? [])
    .filter((v) => v.content_type === "video/mp4")
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]
  return {
    type: m.type === "animated_gif" ? "gif" : "video",
    url: best?.url ?? m.media_url_https,
    poster: m.media_url_https,
    width,
    height,
    alt,
  }
}

/** X serves 48px avatars ("_normal"); the 200px variant stays sharp on retina screens. */
function largerAvatar(url: string): string {
  return url.replace(/_normal(\.\w+)$/, "_200x200$1")
}

function decodeEntities(text: string): string {
  return text.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&")
}
