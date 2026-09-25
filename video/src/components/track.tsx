import { interpolateColors } from "remotion"

import { color } from "../theme"

const MIN_BAR = 0.07

/**
 * Fader's track: one bar per post, ranked best first, and the cap. Bars left of
 * the cap light up blue: those are the posts that reach the feed.
 */
export function Track({
  heights,
  value,
  width,
  height,
  slots,
  ranks,
  grow,
  lit = 1,
  cap = 1,
  capWidth = 12,
}: {
  heights: number[]
  value: number
  width: number
  height: number
  /** Where each bar sits, counted in bars. Fractions are a bar mid-move. Defaults to its index. */
  slots?: number[]
  /** Each bar's rank, 0 being the best. Defaults to its index. */
  ranks?: number[]
  /** How far each bar has grown in, from 0 to 1. */
  grow?: (index: number) => number
  /** 0 until there's a fader: every bar grey. */
  lit?: number
  /** The cap's presence, from 0 to 1. */
  cap?: number
  capWidth?: number
}) {
  const n = heights.length
  const slot = width / n
  const capX = capWidth / 2 + value * (width - capWidth)

  return (
    <div style={{ position: "relative", width, height }}>
      {heights.map((h, i) => {
        const top = ((ranks?.[i] ?? i) + 0.5) / n
        // Ramp over one bar's width as the cap passes, so bars light up smoothly.
        const through = Math.min(Math.max((value - top) * n + 0.5, 0), 1) * lit
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: 0,
              left: (slots?.[i] ?? i) * slot + slot * 0.18,
              width: slot * 0.64,
              height: Math.max(h, MIN_BAR) * height * (grow ? grow(i) : 1),
              background: interpolateColors(through, [0, 1], [color.unlit, color.blue]),
            }}
          />
        )
      })}
      {cap > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: capX - capWidth / 2,
            width: capWidth,
            height,
            borderRadius: capWidth,
            background: "#ffffff",
            boxShadow: `0 0 0 ${Math.max(2, capWidth / 4)}px ${color.bg}`,
            opacity: cap,
            transform: `scaleY(${0.6 + 0.4 * cap})`,
          }}
        />
      )}
    </div>
  )
}
