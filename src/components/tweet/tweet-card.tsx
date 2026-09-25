import {
  ArrowUpRightIcon,
  BadgeCheckIcon,
  ChartNoAxesColumnIcon,
  HeartIcon,
  MessageCircleIcon,
  Repeat2Icon,
  SlidersVerticalIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { TweetMedia } from "@/components/tweet/tweet-media"
import { TweetText } from "@/components/tweet/tweet-text"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { describeRank, formatCount, fullDate, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { EmbeddedTweet, FeedItem, Metrics } from "@/lib/types"

/** Tweets this far up an author's ranking get a "top N%" marker in the feed. */
const STANDOUT_TOP = 0.1

const external = { target: "_blank", rel: "noopener noreferrer" } as const

export function tweetUrl(handle: string, id: string) {
  return `https://x.com/${handle}/status/${id}`
}

type Author = { handle: string; name: string; avatarUrl: string | null; verified?: boolean }

export function TweetCard({
  item,
  showRank = false,
  linkFader = false,
  className,
}: {
  item: FeedItem
  /** Always show the tweet's rank, not only when it's a standout. */
  showRank?: boolean
  /** Link to the author's fader, to turn them up or down from the feed. */
  linkFader?: boolean
  className?: string
}) {
  const { author, content } = item
  const url = tweetUrl(author.handle, item.id)
  // As on X, a reply comes under the post it answers, joined by a thread line.
  const parent = item.kind === "reply" ? content.parent : null

  return (
    <article className={cn("px-4 transition-colors hover:bg-foreground/[0.03]", className)}>
      {parent && <ParentTweet tweet={parent} />}

      <div className={cn("flex gap-2 pb-3", parent ? "pt-1" : "pt-3")}>
        <ProfileAvatar author={author} />
        <div className="min-w-0 flex-1">
          <TweetHeader author={author} createdAt={item.createdAt} url={url}>
            {(showRank || item.top <= STANDOUT_TOP) && <RankChip top={item.top} handle={author.handle} />}
          </TweetHeader>

          {item.kind === "reply" && !parent && item.replyToHandle && (
            <p className="text-muted-foreground">
              Replying to{" "}
              <a href={`https://x.com/${item.replyToHandle}`} {...external} className="text-signal hover:underline">
                @{item.replyToHandle}
              </a>
            </p>
          )}

          {content.text && <TweetText text={content.text} links={content.links} className="mt-0.5" />}

          {content.media.length > 0 && (
            <div className="mt-3">
              <TweetMedia media={content.media} />
            </div>
          )}

          {content.quoted && <QuotedTweet tweet={content.quoted} />}

          <ActionBar metrics={item.metrics} url={url} faderHandle={linkFader ? author.handle : null} />
        </div>
      </div>
    </article>
  )
}

/** The post a reply answers, above it, with the thread line running down to the reply. */
function ParentTweet({ tweet }: { tweet: EmbeddedTweet }) {
  return (
    <div className="flex gap-2 pt-3">
      <div className="flex w-10 shrink-0 flex-col items-center">
        <ProfileAvatar author={tweet.author} />
        <div className="mt-1 w-0.5 flex-1 bg-input" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <TweetHeader author={tweet.author} createdAt={tweet.createdAt} url={tweetUrl(tweet.author.handle, tweet.id)} />
        {tweet.text && <TweetText text={tweet.text} links={tweet.links} className="mt-0.5" />}
        {tweet.media.length > 0 && (
          <div className="mt-3">
            <TweetMedia media={tweet.media} />
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileAvatar({ author }: { author: Author }) {
  return (
    <a href={`https://x.com/${author.handle}`} {...external} className="shrink-0 self-start" tabIndex={-1} aria-hidden>
      <AuthorAvatar name={author.name} src={author.avatarUrl} className="size-10" />
    </a>
  )
}

/** Name, badge, @handle and time on one line; `children` sit at the far end. */
function TweetHeader({
  author,
  createdAt,
  url,
  children,
}: {
  author: Author
  createdAt: number
  url: string
  children?: ReactNode
}) {
  return (
    <header className="flex min-w-0 items-center gap-1 leading-5">
      <a href={`https://x.com/${author.handle}`} {...external} className="truncate font-bold hover:underline">
        {author.name}
      </a>
      {author.verified && <VerifiedBadge />}
      <span className="truncate text-muted-foreground">@{author.handle}</span>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <a href={url} {...external} className="shrink-0 text-muted-foreground hover:underline">
        <time dateTime={new Date(createdAt).toISOString()} title={fullDate(createdAt)} suppressHydrationWarning>
          {timeAgo(createdAt)}
        </time>
      </a>
      {children}
    </header>
  )
}

function RankChip({ top, handle }: { top: number; handle: string }) {
  return (
    <span
      className="readout ml-auto shrink-0 rounded-full bg-signal/10 px-2 text-[13px] leading-5 font-bold text-signal"
      title={`Ranks in the ${describeRank(top)} of @${handle}'s last 30 days`}
    >
      {describeRank(top)}
    </span>
  )
}

function QuotedTweet({ tweet }: { tweet: EmbeddedTweet }) {
  return (
    <a
      href={tweetUrl(tweet.author.handle, tweet.id)}
      {...external}
      className="mt-3 block overflow-hidden rounded-2xl border transition-colors hover:bg-foreground/[0.03]"
    >
      <span className="flex min-w-0 items-center gap-1 px-3 pt-3 leading-5">
        <AuthorAvatar name={tweet.author.name} src={tweet.author.avatarUrl} className="mr-0.5 size-5" />
        <span className="truncate font-bold">{tweet.author.name}</span>
        <span className="truncate text-muted-foreground">@{tweet.author.handle}</span>
        <span className="text-muted-foreground" aria-hidden>
          ·
        </span>
        <time className="shrink-0 text-muted-foreground" suppressHydrationWarning>
          {timeAgo(tweet.createdAt)}
        </time>
      </span>
      {tweet.text ? (
        <TweetText text={tweet.text} links={tweet.links} interactive={false} className="line-clamp-6 px-3 pt-0.5 pb-3" />
      ) : (
        <span className="block pb-3" />
      )}
      {tweet.media.length > 0 && (
        <div className="-mb-px">
          <TweetMedia media={tweet.media} compact />
        </div>
      )}
    </a>
  )
}

const iconButton =
  "-my-1.5 flex size-[34px] items-center justify-center rounded-full transition-colors outline-none hover:bg-signal/10 hover:text-signal focus-visible:ring-2 focus-visible:ring-ring"

/** X's row of counts. They're read-only here: Fader never likes or reposts. */
function ActionBar({ metrics, url, faderHandle }: { metrics: Metrics; url: string; faderHandle: string | null }) {
  return (
    <footer className="mt-3 flex items-center justify-between text-muted-foreground">
      <Metric icon={MessageCircleIcon} value={metrics.replies} label="replies" />
      <Metric icon={Repeat2Icon} value={metrics.reposts + metrics.quotes} label="reposts and quotes" />
      <Metric icon={HeartIcon} value={metrics.likes} label="likes" />
      {metrics.views !== null ? (
        <Metric icon={ChartNoAxesColumnIcon} value={metrics.views} label="views" />
      ) : (
        <span className="w-12" />
      )}
      <span className="-mr-2 flex items-center">
        {faderHandle && (
          <Link
            href={`/accounts/${faderHandle}`}
            className={iconButton}
            aria-label={`@${faderHandle}'s fader`}
            title={`@${faderHandle}'s fader`}
          >
            <SlidersVerticalIcon className="size-[18px]" strokeWidth={1.75} />
          </Link>
        )}
        <a href={url} {...external} className={iconButton} aria-label="Open on X" title="Open on X">
          <ArrowUpRightIcon className="size-[18px]" strokeWidth={1.75} />
        </a>
      </span>
    </footer>
  )
}

function Metric({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <span className="flex min-w-12 items-center gap-1 text-[13px]" title={`${value.toLocaleString("en")} ${label}`}>
      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      {/* Like X, no number when there's nothing to count. */}
      <span className="readout">
        {value > 0 && formatCount(value)}
        <span className="sr-only">
          {value === 0 && "0"} {label}
        </span>
      </span>
    </span>
  )
}

/** X's blue check. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheckIcon
      role="img"
      aria-label="Verified account"
      className={cn("size-[18px] shrink-0 fill-signal text-background", className)}
      strokeWidth={2}
    />
  )
}

export function AuthorAvatar({
  name,
  src,
  className,
}: {
  name: string
  src: string | null
  className?: string
}) {
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="text-xs font-medium">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

function initials(name: string) {
  const letters = Array.from(name.trim()).filter((c) => /\p{L}|\p{N}/u.test(c))
  return (letters[0] ?? "?").toUpperCase()
}
