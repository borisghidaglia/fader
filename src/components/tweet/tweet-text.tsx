import { Fragment, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { Link } from "@/lib/types"

const MENTION_OR_HASHTAG = /(@\w{1,15}|#[\p{L}\p{N}_]+)/gu

/**
 * Tweet text with links, @mentions and #hashtags made clickable. Links show X's
 * short display form. `interactive={false}` renders plain text, for text nested
 * inside another link (a quoted tweet is itself one big link).
 */
export function TweetText({
  text,
  links,
  interactive = true,
  className,
}: {
  text: string
  links: Link[]
  interactive?: boolean
  className?: string
}) {
  return (
    <p className={cn("text-[15px] leading-5 break-words whitespace-pre-wrap", className)}>
      {tokenize(text, links).map((token, i) => (
        <Fragment key={i}>{interactive ? renderToken(token) : token.display}</Fragment>
      ))}
    </p>
  )
}

type Token =
  | { type: "text"; display: string }
  | { type: "link"; display: string; href: string }
  | { type: "mention" | "hashtag"; display: string }

function tokenize(text: string, links: Link[]): Token[] {
  // Split on the known link URLs first (longest first, so no URL eats another's
  // prefix), then find mentions and hashtags in what's left.
  const urls = [...new Set(links.map((l) => l.url))].sort((a, b) => b.length - a.length)
  const display = new Map(links.map((l) => [l.url, l.display]))
  const pieces = urls.length
    ? text.split(new RegExp(`(${urls.map(escapeRegExp).join("|")})`))
    : [text]

  return pieces.flatMap((piece): Token[] => {
    if (!piece) return []
    if (display.has(piece)) return [{ type: "link", display: display.get(piece)!, href: piece }]
    return piece
      .split(MENTION_OR_HASHTAG)
      .filter(Boolean)
      .map((part) =>
        part.startsWith("@") && /^@\w{1,15}$/.test(part)
          ? { type: "mention", display: part }
          : part.startsWith("#") && part.length > 1
            ? { type: "hashtag", display: part }
            : { type: "text", display: part },
      )
  })
}

function renderToken(token: Token): ReactNode {
  switch (token.type) {
    case "text":
      return token.display
    case "link":
      return (
        <a
          href={token.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal hover:underline"
        >
          {token.display}
        </a>
      )
    case "mention":
      return (
        <a
          href={`https://x.com/${token.display.slice(1)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal hover:underline"
        >
          {token.display}
        </a>
      )
    case "hashtag":
      return (
        <a
          href={`https://x.com/hashtag/${encodeURIComponent(token.display.slice(1))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal hover:underline"
        >
          {token.display}
        </a>
      )
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
