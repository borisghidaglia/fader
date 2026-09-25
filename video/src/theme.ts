import { loadFont as loadSans } from "@remotion/google-fonts/Geist"
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono"
import { Easing, interpolate, random } from "remotion"

export const sans = loadSans("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily

export const color = {
  bg: "#000000",
  fg: "#ededed",
  muted: "#a1a1a1",
  faint: "#6e6e6e",
  guide: "rgba(255, 255, 255, 0.09)",
  // X's own greys and blue, for everything that is Fader's UI.
  xText: "#e7e9ea",
  xMuted: "#71767b",
  xBorder: "#2f3336",
  unlit: "#333639",
  blue: "#1d9bf0",
}

/** The content frame, inside the guide lines. */
export const frame = { left: 200, top: 170, width: 1520, height: 740 }

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1)
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1)

/** `t` mapped from [start, end] to [from, to], clamped and eased. */
export function tween(t: number, start: number, end: number, from = 0, to = 1, easing = easeOut) {
  return interpolate(t, [start, end], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  })
}

/** As Fader words a fader position. */
export function describeRatio(value: number) {
  if (value <= 0.005) return "Muted"
  if (value >= 0.995) return "Everything"
  return `Top ${Math.max(1, Math.round(value * 100))}%`
}

export function formatRate(perDay: number) {
  if (perDay < 0.05) return "0"
  return perDay < 10 ? perDay.toFixed(1) : Math.round(perDay).toString()
}

/**
 * A month of someone's posts, oldest first: most get a little engagement, a few
 * take off. Heights are relative to their best post.
 */
export function monthOfPosts(seed: string, count: number) {
  const raw = Array.from({ length: count }, (_, i) => Math.pow(random(`${seed}-${i}`), 2.6))
  const best = Math.max(...raw)
  return raw.map((r) => 0.07 + 0.93 * (r / best))
}

/** The same posts ranked best first. */
export function ranked(heights: number[]) {
  return heights.toSorted((a, b) => b - a)
}
