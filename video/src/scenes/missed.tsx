import { AbsoluteFill, useCurrentFrame } from "remotion"

import { expert, friend } from "../cast"
import {
  FeedCard,
  FeedRow,
  FollowingHeader,
  LEFT,
  MissingRow,
  RIGHT,
  ROW,
  SaidHeader,
  lifted,
  rowAt,
  type Author,
  type Said,
} from "../components/feed"
import { Reveal, useEnter } from "../components/reveal"
import type { Cue } from "../sound"
import { at, title } from "../styles"
import { color, easeInOut, tween } from "../theme"

/** One day from two people you follow. One reply of each never reaches your feed: it answers someone you don't follow. */
const said: { author: Author; item: Said; arrives: boolean }[] = [
  { author: friend, item: { kind: "Post", ago: "1h", line: 0.86 }, arrives: true },
  { author: friend, item: { kind: "Reply", ago: "2h", line: 0.58 }, arrives: false },
  { author: expert, item: { kind: "Post", ago: "3h", line: 0.66 }, arrives: true },
  { author: friend, item: { kind: "Post", ago: "4h", line: 0.74 }, arrives: true },
  { author: expert, item: { kind: "Reply", ago: "6h", line: 0.8 }, arrives: false },
]

const FLY = 44
/** When row `i` sets off for the feed, or would have. */
const flightAt = (i: number) => 118 + i * 14
/** When the gap left by a row that never arrives draws in. */
const gapAt = (i: number) => flightAt(i) + FLY * 0.5

export const sounds: Cue[] = [
  { at: 34, sound: "pop", volume: 0.25 },
  { at: 46, sound: "pop", volume: 0.25 },
  ...said.map((_, i) => ({ at: 52 + i * 8, sound: `tick-${i % 4}`, volume: 0.2 })),
  { at: 70, sound: "click", volume: 0.3 },
  ...said.flatMap(({ arrives }, i): Cue[] =>
    arrives
      ? [
          { at: flightAt(i), sound: "whoosh", volume: 0.18 },
          { at: flightAt(i) + FLY - 3, sound: "land", volume: 0.32 },
        ]
      : [{ at: gapAt(i) + 2, sound: "missing", volume: 0.4 }],
  ),
]

/** The problem: following someone doesn't get you what they say, even on Recent. */
export function Missed() {
  const frame = useCurrentFrame()
  const leftCard = useEnter(34)
  const rightCard = useEnter(46)

  return (
    <AbsoluteFill>
      <div style={{ ...at(80, 56), ...title, fontSize: 64 }}>
        <div>
          <Reveal text="You follow people." />
        </div>
        <div style={{ color: color.muted }}>
          <Reveal text="You still miss some of what they say." start={16} />
        </div>
      </div>

      <FeedCard x={LEFT} style={leftCard} header={<SaidHeader />}>
        {said.map(({ author, item }, i) => (
          <FeedRow
            key={i}
            author={author}
            item={item}
            style={{ top: i * ROW, opacity: tween(frame, 52 + i * 8, 76 + i * 8) }}
          />
        ))}
      </FeedCard>

      <FeedCard x={RIGHT} style={rightCard} header={<FollowingHeader recentAt={70} />}>
        {/* Across from each reply that never arrives, the gap it leaves, drawn in when it would have landed. */}
        {said.map(({ item, arrives }, i) => {
          if (arrives) return null
          const gap = tween(frame, gapAt(i), flightAt(i) + FLY)
          return (
            <MissingRow
              key={i}
              kind={item.kind}
              style={{ top: i * ROW, opacity: gap, transform: `scale(${0.96 + 0.04 * gap})` }}
            />
          )
        })}
      </FeedCard>

      {said.map(({ author, item, arrives }, i) => {
        // Once they're all there, each one that arrives heads for the feed, straight across.
        if (!arrives) return null
        const p = tween(frame, flightAt(i), flightAt(i) + FLY, 0, 1, easeInOut)
        if (p <= 0) return null
        return (
          <FeedRow
            key={i}
            author={author}
            item={item}
            style={{
              ...rowAt(LEFT + (RIGHT - LEFT) * p, i),
              ...lifted(p),
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}
