import type { ReactNode } from "react"
import { Freeze, useCurrentFrame } from "remotion"

/** A pause in a scene: at frame `at` of its own timeline, it holds still for `frames`. */
export type Hold = { at: number; frames: number }

export function held(holds: Hold[]) {
  return holds.reduce((sum, h) => sum + h.frames, 0)
}

/** When frame `at` of a scene's own timeline shows, once it's paced by `holds`. */
export function pacedFrame(holds: Hold[], at: number) {
  return at + held(holds.filter((h) => h.at < at))
}

/** Plays a scene with pauses to read by, without slowing any of its motion. */
export function Paced({ holds, children }: { holds: Hold[]; children: ReactNode }) {
  let t = useCurrentFrame()
  for (const { at, frames } of holds) if (t > at) t = Math.max(at, t - frames)
  return <Freeze frame={t}>{children}</Freeze>
}
