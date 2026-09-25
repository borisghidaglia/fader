import type { CSSProperties } from "react"
import { useCurrentFrame } from "remotion"

import { tween } from "../theme"

/** Text that rises into place word by word, out of a blur. */
export function Reveal({
  text,
  start = 0,
  stagger = 3,
  style,
}: {
  text: string
  start?: number
  stagger?: number
  style?: CSSProperties
}) {
  const frame = useCurrentFrame()
  const words = text.split(" ")

  return (
    <span style={style}>
      {words.map((word, i) => {
        const t = tween(frame, start + i * stagger, start + i * stagger + 30)
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              opacity: t,
              transform: `translateY(${(1 - t) * 0.35}em)`,
              filter: `blur(${(1 - t) * 10}px)`,
            }}
          >
            {i < words.length - 1 ? `${word} ` : word}
          </span>
        )
      })}
    </span>
  )
}

/** Fades and lifts a block into place. */
export function useEnter(start: number, duration = 30, distance = 24) {
  const frame = useCurrentFrame()
  const t = tween(frame, start, start + duration)
  return {
    opacity: t,
    transform: `translateY(${(1 - t) * distance}px)`,
    filter: `blur(${(1 - t) * 6}px)`,
  } satisfies CSSProperties
}
