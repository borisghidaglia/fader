import type { CSSProperties, ReactNode } from "react"
import { interpolateColors, useCurrentFrame } from "remotion"

import { label } from "../styles"
import { color, frame as box, mono, sans, tween } from "../theme"
import { Avatar } from "./avatar"

// Two X-style timelines side by side: everything someone said, and your following feed.

export const LEFT = 80
export const RIGHT = 780
export const CARD_WIDTH = 660
export const CARD_TOP = 236
export const HEADER = 76
export const ROW = 84
/** Rows a card shows; the rest are cut off at its bottom edge. */
export const ROWS = 5

export type Author = { name: string; hue: number }
export type Said = { kind: "Post" | "Reply"; ago: string; line: number }

/** On screen, where row `y` of the card at `x` sits (`y` counts rows and can be fractional). */
export function rowAt(x: number, y: number): CSSProperties {
  return { left: box.left + x + 1, top: box.top + CARD_TOP + 1 + HEADER + y * ROW }
}

/**
 * A row picked up off one timeline and carried to another, `p` of the way: it lifts
 * into a card of its own, then settles back into a plain row as it lands.
 */
export function lifted(p: number): CSSProperties {
  const lift = Math.sin(Math.PI * p)
  return {
    background: color.bg,
    border: `1px solid rgba(113, 118, 123, ${0.6 * lift})`,
    borderRadius: 16 * lift,
    boxShadow: `0 24px 60px rgba(0, 0, 0, ${0.7 * lift})`,
    transform: `scale(${1 + 0.03 * lift})`,
    // The one lifted highest passes over the others.
    zIndex: Math.round(1 + 100 * lift),
  }
}

/** A timeline card. Its children are rows placed with `top` inside its body. */
export function FeedCard({
  x,
  header,
  style,
  children,
}: {
  x: number
  header: ReactNode
  style?: CSSProperties
  children?: ReactNode
}) {
  return (
    <div
      style={{
        ...style,
        position: "absolute",
        left: box.left + x,
        top: box.top + CARD_TOP,
        width: CARD_WIDTH,
        height: HEADER + ROWS * ROW + 2,
        boxSizing: "border-box",
        border: `1px solid ${color.xBorder}`,
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: HEADER,
          boxSizing: "border-box",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${color.xBorder}`,
        }}
      >
        {header}
      </div>
      <div style={{ position: "absolute", top: HEADER, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  )
}

/** The left card's header. */
export function SaidHeader({ count }: { count?: number }) {
  return (
    <>
      <div style={{ ...label, fontSize: 18 }}>Everything they said today</div>
      {count !== undefined && (
        <div style={{ fontFamily: mono, fontSize: 22, color: color.xText, fontVariantNumeric: "tabular-nums" }}>
          {count}
        </div>
      )}
    </>
  )
}

/** The right card's header: your following feed, set to Recent from `recentAt`. */
export function FollowingHeader({ recentAt }: { recentAt: number }) {
  const frame = useCurrentFrame()
  const on = tween(frame, recentAt, recentAt + 16)
  return (
    <>
      <div style={{ fontFamily: sans, fontSize: 30, fontWeight: 700, color: color.xText, letterSpacing: "-0.02em" }}>
        Your following feed
      </div>
      <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, border: `1px solid ${color.xBorder}` }}>
        {["Recent", "Popular"].map((option, i) => (
          <div
            key={option}
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              fontFamily: sans,
              fontSize: 20,
              fontWeight: 600,
              background: i === 0 ? `rgba(255,255,255,${on})` : "transparent",
              color: i === 0 ? interpolateColors(on, [0, 1], [color.xMuted, "#000000"]) : color.xMuted,
            }}
          >
            {option}
          </div>
        ))}
      </div>
    </>
  )
}

/** One post or reply, as a row of a timeline. Place it with `left` and `top`. */
export function FeedRow({ author, item, style }: { author: Author; item: Said; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: CARD_WIDTH - 2,
        height: ROW,
        boxSizing: "border-box",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        fontFamily: sans,
        ...style,
      }}
    >
      <Avatar name={author.name} hue={author.hue} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 24, lineHeight: 1.2 }}>
          <span style={{ fontWeight: 700, color: color.xText }}>{author.name}</span>
          <span style={{ color: color.xMuted }}>· {item.ago}</span>
        </div>
        <div style={{ marginTop: 11, height: 12, width: `${item.line * 100}%`, borderRadius: 6, background: color.xBorder }} />
      </div>
      <Tag>{item.kind}</Tag>
    </div>
  )
}

/** Where a post or reply should have been, in a feed that never got it. */
export function MissingRow({ kind, style }: { kind: Said["kind"]; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        width: CARD_WIDTH - 2 - 24,
        height: ROW - 16,
        marginTop: 8,
        boxSizing: "border-box",
        border: `2px dashed ${color.faint}`,
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: mono,
        fontSize: 18,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: color.muted,
        ...style,
      }}
    >
      Missing {kind.toLowerCase()}
    </div>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: mono,
        fontSize: 16,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: color.xMuted,
        padding: "3px 10px",
        border: `1px solid ${color.xBorder}`,
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  )
}
