import type { CSSProperties } from "react"

import { color, frame, mono, sans } from "./theme"

export const title: CSSProperties = {
  fontFamily: sans,
  fontSize: 68,
  fontWeight: 600,
  letterSpacing: "-0.045em",
  lineHeight: 1.08,
  color: color.fg,
}

export const label: CSSProperties = {
  fontFamily: mono,
  fontSize: 19,
  fontWeight: 400,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: color.muted,
}

/** A block placed inside the content frame, `x` and `y` from its top left. */
export function at(x: number, y: number, width = frame.width - 2 * x): CSSProperties {
  return { position: "absolute", left: frame.left + x, top: frame.top + y, width }
}
