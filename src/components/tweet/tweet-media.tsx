"use client"

import { PlayIcon } from "lucide-react"

import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import type { Media } from "@/lib/types"

/** pbs.twimg.com serves resized variants through the `name` parameter. */
function sized(url: string, name: "small" | "medium" | "orig") {
  return url.startsWith("https://pbs.twimg.com/media/") ? `${url}?name=${name}` : url
}

/** Photos, videos and GIFs in X's 1–4 tile layout. */
export function TweetMedia({ media, compact = false }: { media: Media[]; compact?: boolean }) {
  if (media.length === 0) return null
  const tiles = media.slice(0, 4)

  if (tiles.length === 1) {
    const [only] = tiles
    const ratio = only.width && only.height ? only.width / only.height : 16 / 9
    return (
      <div
        className={cn("overflow-hidden bg-muted", compact ? "max-h-72" : "max-h-[34rem] rounded-2xl border")}
        // Very tall images are cropped to 3:4, like X does.
        style={{ aspectRatio: Math.max(ratio, 0.75) }}
      >
        <MediaTile media={only} compact={compact} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "grid aspect-video gap-0.5 overflow-hidden bg-muted",
        tiles.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2",
        // Inside a quoted tweet, media runs to the card's edges.
        compact ? "max-h-72" : "rounded-2xl border",
      )}
    >
      {tiles.map((m, i) => (
        <div key={m.url} className={cn("min-h-0", tiles.length === 3 && i === 0 && "row-span-2")}>
          <MediaTile media={m} compact={compact} />
        </div>
      ))}
    </div>
  )
}

function MediaTile({ media, compact }: { media: Media; compact: boolean }) {
  const reducedMotion = useReducedMotion()

  // Compact tiles sit inside a quoted tweet, which is itself a link: stills only.
  if (compact) {
    return (
      <div className="relative size-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- X already serves sized variants */}
        <img src={sized(media.poster, "small")} alt={media.alt ?? ""} loading="lazy" className="size-full object-cover" />
        {media.type !== "photo" && (
          <PlayIcon className="absolute inset-0 m-auto size-6 fill-white text-white drop-shadow" aria-hidden />
        )}
      </div>
    )
  }

  if (media.type === "photo") {
    return (
      <a href={sized(media.url, "orig")} target="_blank" rel="noopener noreferrer" className="block size-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- X already serves sized variants */}
        <img
          src={sized(media.url, "medium")}
          alt={media.alt ?? ""}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      </a>
    )
  }

  const gif = media.type === "gif" && !reducedMotion
  return (
    <video
      src={media.url}
      poster={sized(media.poster, "medium")}
      aria-label={media.alt ?? (media.type === "gif" ? "GIF" : "Video")}
      className="size-full bg-black object-contain"
      playsInline
      preload="none"
      {...(gif ? { autoPlay: true, loop: true, muted: true } : { controls: true })}
    />
  )
}
