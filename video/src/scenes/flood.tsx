import { AbsoluteFill, random, useCurrentFrame } from "remotion"

import { expert, founder, friend, hotTakes, news, yapper } from "../cast"
import { Avatar } from "../components/avatar"
import {
  CARD_TOP,
  CARD_WIDTH,
  FeedCard,
  FeedRow,
  FollowingHeader,
  HEADER,
  LEFT,
  RIGHT,
  ROW,
  ROWS,
  SaidHeader,
  lifted,
  rowAt,
  type Author,
  type Said,
} from "../components/feed"
import { Reveal, useEnter } from "../components/reveal"
import type { Cue } from "../sound"
import { at, title } from "../styles"
import { color, easeInOut, frame as box, sans, tween } from "../theme"

/** Your feed before they start: what got through in the last scene, then older posts. */
const earlier: { author: Author; item: Said }[] = [
  { author: friend, item: { kind: "Post", ago: "1h", line: 0.86 } },
  { author: expert, item: { kind: "Post", ago: "3h", line: 0.66 } },
  { author: friend, item: { kind: "Post", ago: "4h", line: 0.74 } },
  { author: expert, item: { kind: "Post", ago: "7h", line: 0.62 } },
  { author: friend, item: { kind: "Reply", ago: "8h", line: 0.7 } },
]

/** The kinds of accounts that never stop. */
const noisy = [founder, yapper, news, hotTakes]

/** How many they post in the hour. */
const COUNT = 38

/**
 * Their posts, oldest first, aged as they are once the last one is in. The first few
 * take turns, so each of them is seen; after that it's anyone's.
 */
const posts: { author: Author; item: Said }[] = Array.from({ length: COUNT }, (_, i) => ({
  author: i < noisy.length ? noisy[i] : noisy[Math.floor(random(`flood-author-${i}`) * noisy.length)],
  item: {
    kind: random(`flood-kind-${i}`) < 0.6 ? "Reply" : "Post",
    ago: `${Math.round(1 + (COUNT - 1 - i) * 1.5)}m`,
    line: 0.45 + 0.45 * random(`flood-line-${i}`),
  },
}))

/** When each is posted: slowly, then faster and faster. */
const POSTED: number[] = []
for (let i = 0, t = 84; i < COUNT; i++) {
  POSTED.push(t)
  t += Math.max(2, Math.round(18 * 0.8 ** i))
}
const FLY = 30
const LANDS = POSTED.map((t) => t + 8 + FLY)
/** The first few fly across one by one; once they come too fast, they just land. */
const FLYING = 5
const LAST = LANDS[COUNT - 1]

export const sounds: Cue[] = [
  { at: 34, sound: "pop", volume: 0.25 },
  { at: 46, sound: "pop", volume: 0.25 },
  // A tick for each post, into a rattle as they come faster.
  ...POSTED.map((t, i) => ({
    at: t,
    sound: `tick-${Math.floor(random(`flood-tick-${i}`) * 4)}`,
    volume: 0.16 + (0.1 * i) / (COUNT - 1),
  })),
  ...POSTED.flatMap((t, i): Cue[] =>
    i < FLYING
      ? [
          { at: t + 8, sound: "whoosh-short", volume: 0.18 },
          { at: LANDS[i] - 3, sound: "land", volume: 0.35 },
        ]
      : [{ at: LANDS[i] - 6, sound: "land", volume: 0.12 }],
  ),
  { at: LAST + 10, sound: "notify", volume: 0.45 },
]

/** How far a new row at the top pushes the others down, in rows. */
const push = (frame: number, at: number) => tween(frame, at, at + 12)

/** Row of post `i` on the left card, newest on top. */
function leftRow(i: number, frame: number) {
  let y = 0
  for (let j = i + 1; j < COUNT; j++) y += push(frame, POSTED[j])
  return y
}

/** Row of post `i` in your feed. Each landing opens the top row just in time. */
function feedRow(i: number, frame: number) {
  let y = 0
  for (let j = i + 1; j < COUNT; j++) y += push(frame, LANDS[j] - 12)
  return y
}

/** Accounts that never stop, taking over your feed. */
export function Flood() {
  const frame = useCurrentFrame()
  const leftCard = useEnter(34)
  const rightCard = useEnter(46)
  const posted = POSTED.filter((t) => t <= frame).length
  const pushedDown = feedRow(-1, frame)

  return (
    <AbsoluteFill>
      <div style={{ ...at(80, 56), ...title, fontSize: 64 }}>
        <div>
          <Reveal text="Others never stop posting." />
        </div>
        <div style={{ color: color.muted }}>
          <Reveal text="They flood your feed." start={16} />
        </div>
      </div>

      <FeedCard x={LEFT} style={leftCard} header={<SaidHeader count={posted} />}>
        {posts.map(({ author, item }, i) => {
          if (frame < POSTED[i]) return null
          const y = leftRow(i, frame)
          if (y >= ROWS) return null
          return (
            <FeedRow
              key={i}
              author={author}
              item={item}
              style={{ top: y * ROW, opacity: tween(frame, POSTED[i], POSTED[i] + 8) }}
            />
          )
        })}
      </FeedCard>

      <FeedCard x={RIGHT} style={rightCard} header={<FollowingHeader recentAt={-100} />}>
        {earlier.map(({ author, item }, k) => {
          const y = k + pushedDown
          if (y >= ROWS) return null
          return <FeedRow key={`earlier-${k}`} author={author} item={item} style={{ top: y * ROW }} />
        })}
        {posts.map(({ author, item }, i) => {
          const flies = i < FLYING
          if (frame < LANDS[i] - (flies ? 0 : 12)) return null
          const y = feedRow(i, frame)
          if (y >= ROWS) return null
          const t = flies ? 1 : tween(frame, LANDS[i] - 12, LANDS[i])
          return (
            <FeedRow
              key={i}
              author={author}
              item={item}
              style={{ top: y * ROW, background: color.bg, opacity: t, transform: `translateX(${(1 - t) * -40}px)` }}
            />
          )
        })}
      </FeedCard>

      {/* The first ones fly across into the top of your feed. */}
      {posts.slice(0, FLYING).map(({ author, item }, i) => {
        const start = POSTED[i] + 8
        if (frame < start || frame >= LANDS[i]) return null
        const p = tween(frame, start, LANDS[i], 0, 1, easeInOut)
        const y = leftRow(i, frame) + (feedRow(i, frame) - leftRow(i, frame)) * p
        return (
          <FeedRow
            key={i}
            author={author}
            item={item}
            style={{
              ...rowAt(LEFT + (RIGHT - LEFT) * p, y),
              ...lifted(p),
            }}
          />
        )
      })}

      <Buried count={COUNT} start={LAST + 10} />
    </AbsoluteFill>
  )
}

/** X's blue pill, pointing down to where your friend went. */
function Buried({ count, start }: { count: number; start: number }) {
  const frame = useCurrentFrame()
  const t = tween(frame, start, start + 24)
  return (
    <div
      style={{
        position: "absolute",
        left: box.left + RIGHT + CARD_WIDTH / 2,
        top: box.top + CARD_TOP + HEADER + ROWS * ROW - 84,
        transform: `translate(-50%, ${(1 - t) * 24}px) scale(${0.94 + 0.06 * t})`,
        opacity: t,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 24px 10px 14px",
        borderRadius: 999,
        background: color.blue,
        boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
        fontFamily: sans,
        fontSize: 22,
        fontWeight: 700,
        color: "#ffffff",
        whiteSpace: "nowrap",
      }}
    >
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v16M5 13l7 7 7-7" />
      </svg>
      <Avatar name={friend.name} hue={friend.hue} size={32} />
      {friend.name} is {count} posts down
    </div>
  )
}
