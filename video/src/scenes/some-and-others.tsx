import { AbsoluteFill, useCurrentFrame } from "remotion"

import { Reveal } from "../components/reveal"
import { Track } from "../components/track"
import { detents, type Cue } from "../sound"
import { at, label, title } from "../styles"
import { describeRatio, easeInOut, monthOfPosts, ranked, tween } from "../theme"

const rows = [
  { text: "Some people, I want every post and every reply.", seed: "friend", from: 0, to: 1, start: 0 },
  { text: "Others, only their best.", seed: "prolific", from: 1, to: 0.15, start: 70 },
]

const BARS = 24

/** Where a row's fader is: at `from`, then slid to `to`. */
const valueAt = ({ from, to, start }: (typeof rows)[number], frame: number) =>
  from + (to - from) * tween(frame, start + 44, start + 92, 0, 1, easeInOut)

export const sounds: Cue[] = rows.flatMap((row) => [
  { at: row.start + 28, sound: "click", volume: 0.2 },
  ...detents((frame) => valueAt(row, frame), BARS, row.start + 44, row.start + 92),
])

/** The two cases from the original ask. */
export function SomeAndOthers() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill>
      {rows.map((row, i) => (
        <Row key={row.seed} {...row} value={valueAt(row, frame)} top={150 + i * 270} />
      ))}
    </AbsoluteFill>
  )
}

function Row({
  text,
  seed,
  start,
  value,
  top,
}: {
  text: string
  seed: string
  start: number
  value: number
  top: number
}) {
  const frame = useCurrentFrame()
  const heights = ranked(monthOfPosts(seed, BARS))
  const cap = tween(frame, start + 28, start + 44)

  return (
    <div style={{ ...at(80, top), display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ ...title, fontSize: 58, maxWidth: 780 }}>
        <Reveal text={text} start={start} />
      </div>
      <div style={{ opacity: tween(frame, start + 10, start + 30) }}>
        <Track
          heights={heights}
          value={value}
          width={460}
          height={100}
          grow={(i) => tween(frame, start + 10 + i * 0.8, start + 32 + i * 0.8)}
          cap={cap}
          lit={cap}
          capWidth={10}
        />
        <p style={{ ...label, margin: "18px 0 0", opacity: cap }}>{describeRatio(value)}</p>
      </div>
    </div>
  )
}
