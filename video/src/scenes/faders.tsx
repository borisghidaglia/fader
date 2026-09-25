import { AbsoluteFill, interpolateColors, random, useCurrentFrame } from "remotion"

import { founder } from "../cast"
import { Avatar } from "../components/avatar"
import { Cursor } from "../components/cursor"
import { Reveal, useEnter } from "../components/reveal"
import { detents, type Cue } from "../sound"
import { label, title } from "../styles"
import { color, describeRatio, easeInOut, formatRate, frame as box, monthOfPosts, sans, tween } from "../theme"

// A prolific founder's month: fewer posts than replies, and replies get far less engagement.
const PER_DAY = { posts: 14, replies: 24 }
/**
 * Bars on each of the split tracks. A month of either is well over 40, and Fader draws
 * at most 40 bars a track, so both are full and line up.
 */
const BARS = 40
const TWEETS = (() => {
  const posts = monthOfPosts("founder-post", BARS).map((own) => ({ reply: false, own, all: own }))
  const replies = monthOfPosts("founder-reply", BARS).map((own) => ({ reply: true, own, all: own * 0.42 }))
  const list = [...posts, ...replies]
    .map((t, i) => ({ ...t, when: random(`founder-when-${i}`) }))
    .sort((a, b) => a.when - b.when)
  const rankBy = (subset: typeof list, key: "own" | "all") => {
    const order = subset.toSorted((a, b) => b[key] - a[key])
    return (t: (typeof list)[number]) => order.indexOf(t)
  }
  const rankAll = rankBy(list, "all")
  const rankPost = rankBy(list.filter((t) => !t.reply), "own")
  const rankReply = rankBy(list.filter((t) => t.reply), "own")
  return list.map((t) => ({ ...t, rankAll: rankAll(t), rankKind: t.reply ? rankReply(t) : rankPost(t) }))
})()
const N = TWEETS.length
const N_POSTS = TWEETS.filter((t) => !t.reply).length
const N_REPLIES = N - N_POSTS

// How many frames apart the first and last bars start to grow, sort and split, whatever their number.
const GROW_SPREAD = 44
const SORT_SPREAD = 22
const SPLIT_SPREAD = 20

// Layout, from the content frame's top left.
const X = 80
const W = 1360
const SINGLE = { top: 300, height: 240 }
const POSTS = { label: 288, top: 330, height: 100 }
const REPLIES = { label: 460, top: 502, height: 100 }
const SWITCH = { top: 642, width: 64, height: 38 }
const CAP = 12
const MIN_BAR = 0.06

const capX = (value: number) => X + CAP / 2 + value * (W - CAP)
const slotOf = (n: number) => ({ slot: W / n, bar: Math.min((W / n) * 0.64, 24) })
const ramp = (value: number, rank: number, n: number) => Math.min(Math.max((value - (rank + 0.5) / n) * n + 0.5, 0), 1)

const captions = [
  { text: "A month of their posts and replies", from: 48, to: 132 },
  { text: "Ranked by engagement, against each other", from: 140, to: 214 },
  { text: "Slide to keep only their best", from: 224, to: 330 },
]

/** Where the faders are: one slid down, then split, then posts up and replies down. */
function levels(frame: number) {
  const single = 1 - 0.7 * tween(frame, 252, 300, 0, 1, easeInOut)
  return {
    single,
    posts: single + 0.7 * tween(frame, 486, 536, 0, 1, easeInOut),
    replies: single - 0.2 * tween(frame, 566, 612, 0, 1, easeInOut),
  }
}

export const sounds: Cue[] = [
  { at: 26, sound: "pop", volume: 0.22 },
  { at: 138, sound: "shuffle", volume: 0.25 },
  { at: 214, sound: "click", volume: 0.3 },
  // A detent every other bar: one a bar would be a buzz across this many.
  ...detents((frame) => levels(frame).single, N / 2, 252, 300),
  { at: 318, sound: "pop", volume: 0.2 },
  { at: 367, sound: "click", volume: 0.3 },
  { at: 372, sound: "toggle", volume: 0.35 },
  { at: 390, sound: "shuffle", volume: 0.2 },
  { at: 480, sound: "click", volume: 0.3 },
  ...detents((frame) => levels(frame).posts, N_POSTS, 486, 536),
  { at: 561, sound: "click", volume: 0.3 },
  ...detents((frame) => levels(frame).replies, N_REPLIES, 566, 612),
]

/** One fader for an account, then two: the switch splits it into posts and replies. */
export function Faders() {
  const frame = useCurrentFrame()
  const header = useEnter(26)
  const switchRow = useEnter(318)

  const cap = tween(frame, 212, 236)
  const lit = tween(frame, 214, 244)
  const { single, posts, replies } = levels(frame)
  const toggle = tween(frame, 372, 384, 0, 1, easeInOut)
  const split = tween(frame, 390, 450, 0, 1, easeInOut)
  const kindLabels = tween(frame, 428, 458)
  const shownPerDay = split > 0 ? PER_DAY.posts * posts + PER_DAY.replies * replies : (PER_DAY.posts + PER_DAY.replies) * single

  const oldTitle = tween(frame, 344, 362)
  const grabPosts = tween(frame, 478, 486) - tween(frame, 536, 542)
  const grabReplies = tween(frame, 560, 566) - tween(frame, 612, 618)

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height }}>
        <div
          style={{
            ...title,
            position: "absolute",
            left: X,
            top: 70,
            opacity: 1 - oldTitle,
            filter: `blur(${10 * oldTitle}px)`,
            transform: `translateY(${-14 * oldTitle}px)`,
          }}
        >
          <Reveal text="Give every account a fader." />
        </div>
        <div style={{ ...title, position: "absolute", left: X, top: 70 }}>
          <Reveal text="Or two: posts and replies." start={362} />
        </div>

        <div style={{ ...header, position: "absolute", left: X, top: 186, width: W, display: "flex", alignItems: "center", gap: 20 }}>
          <Avatar name={founder.name} hue={founder.hue} size={64} />
          <div style={{ flex: 1, fontFamily: sans, lineHeight: 1.25 }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: color.xText, letterSpacing: "-0.02em" }}>{founder.name}</div>
            <div style={{ fontSize: 22, color: color.xMuted }}>{PER_DAY.posts + PER_DAY.replies} posts a day</div>
          </div>
          {/* One fader: its setting, and what it lets through. Two: what they let through together. */}
          <div style={{ position: "relative", textAlign: "right", fontFamily: sans, lineHeight: 1.2, opacity: cap, fontVariantNumeric: "tabular-nums" }}>
            <div style={{ opacity: 1 - kindLabels }}>
              <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.035em", color: color.blue }}>
                {describeRatio(single)}
              </div>
              <div style={{ fontSize: 22, color: color.xMuted }}>≈{formatRate(shownPerDay)} a day in your feed</div>
            </div>
            <div style={{ position: "absolute", right: 0, top: 0, whiteSpace: "nowrap", opacity: kindLabels }}>
              <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.035em", color: color.fg }}>
                ≈{formatRate(shownPerDay)} a day
              </div>
              <div style={{ fontSize: 22, color: color.xMuted }}>in your feed</div>
            </div>
          </div>
        </div>

        {TWEETS.map((t, i) => {
          const growAt = 40 + (i / N) * GROW_SPREAD
          const sortAt = 138 + (t.rankAll / N) * SORT_SPREAD
          const moveAt = 390 + (t.rankKind / BARS) * SPLIT_SPREAD
          const grow = tween(frame, growAt, growAt + 22)
          const sort = tween(frame, sortAt, sortAt + 52, 0, 1, easeInOut)
          const move = tween(frame, moveAt, moveAt + 50, 0, 1, easeInOut)

          const one = slotOf(N)
          const own = slotOf(t.reply ? N_REPLIES : N_POSTS)
          const track = t.reply ? REPLIES : POSTS
          const x1 = (i + (t.rankAll - i) * sort) * one.slot + (one.slot - one.bar) / 2
          const x2 = t.rankKind * own.slot + (own.slot - own.bar) / 2
          const h1 = Math.max(t.all, MIN_BAR) * SINGLE.height
          const h2 = Math.max(t.own, MIN_BAR) * track.height
          const bottom1 = SINGLE.top + SINGLE.height
          const bottom2 = track.top + track.height

          const through =
            ramp(single, t.rankAll, N) * lit * (1 - move) +
            ramp(t.reply ? replies : posts, t.rankKind, t.reply ? N_REPLIES : N_POSTS) * move
          const height = (h1 + (h2 - h1) * move) * grow

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: X + x1 + (x2 - x1) * move,
                top: bottom1 + (bottom2 - bottom1) * move - height,
                width: one.bar + (own.bar - one.bar) * move,
                height,
                background: interpolateColors(through, [0, 1], [color.unlit, color.blue]),
              }}
            />
          )
        })}

        <FaderCap value={posts} top={SINGLE.top + (POSTS.top - SINGLE.top) * split} height={SINGLE.height + (POSTS.height - SINGLE.height) * split} presence={cap} grab={grabPosts} />
        <FaderCap value={replies} top={SINGLE.top + (REPLIES.top - SINGLE.top) * split} height={SINGLE.height + (REPLIES.height - SINGLE.height) * split} presence={cap} grab={grabReplies} />

        {captions.map((caption) => (
          <p
            key={caption.text}
            style={{
              ...label,
              position: "absolute",
              left: X,
              top: SINGLE.top + SINGLE.height + 26,
              margin: 0,
              opacity: tween(frame, caption.from, caption.from + 16) - tween(frame, caption.to, caption.to + 12),
            }}
          >
            {caption.text}
          </p>
        ))}

        <KindLabel name="Posts" perDay={PER_DAY.posts} value={posts} top={POSTS.label} opacity={kindLabels} />
        <KindLabel name="Replies" perDay={PER_DAY.replies} value={replies} top={REPLIES.label} opacity={kindLabels} />

        <div
          style={{
            ...switchRow,
            position: "absolute",
            left: X,
            top: SWITCH.top,
            width: W,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: sans,
          }}
        >
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: color.xText, letterSpacing: "-0.015em" }}>
              Separate fader for replies
            </div>
            <div style={{ fontSize: 20, color: color.xMuted }}>Rank their replies apart from their posts, and set each on its own.</div>
          </div>
          <Toggle on={toggle} />
        </div>

        <Pointer
          frame={frame}
          posts={posts}
          replies={replies}
          press={tween(frame, 366, 370) - tween(frame, 376, 382) + grabPosts + grabReplies}
        />
      </div>
    </AbsoluteFill>
  )
}

function FaderCap({ value, top, height, presence, grab }: { value: number; top: number; height: number; presence: number; grab: number }) {
  if (presence <= 0) return null
  return (
    <div
      style={{
        position: "absolute",
        left: capX(value) - CAP / 2,
        top,
        width: CAP,
        height,
        borderRadius: CAP,
        background: "#ffffff",
        boxShadow: `0 0 0 3px ${color.bg}`,
        opacity: presence,
        transform: `scaleY(${0.6 + 0.4 * presence}) scaleX(${1 + 0.3 * grab})`,
      }}
    />
  )
}

function KindLabel({ name, perDay, value, top, opacity }: { name: string; perDay: number; value: number; top: number; opacity: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: X,
        top,
        width: W,
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        fontFamily: sans,
        opacity,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div style={{ fontSize: 28, letterSpacing: "-0.02em" }}>
        <span style={{ fontWeight: 700, color: color.xText }}>{name}</span>
        <span style={{ color: color.xMuted }}> · {perDay} a day</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: value > 0.005 ? color.blue : color.xMuted }}>
        {describeRatio(value)}
      </div>
    </div>
  )
}

/** X's toggle, as in Fader's account page. */
function Toggle({ on }: { on: number }) {
  const knob = SWITCH.height - 8
  return (
    <div
      style={{
        width: SWITCH.width,
        height: SWITCH.height,
        padding: 4,
        borderRadius: 999,
        background: interpolateColors(on, [0, 1], [color.unlit, color.blue]),
      }}
    >
      <div
        style={{
          width: knob,
          height: knob,
          borderRadius: "50%",
          background: color.xText,
          transform: `translateX(${on * (SWITCH.width - 8 - knob)}px)`,
        }}
      />
    </div>
  )
}

/** Clicks the switch, then drags the posts cap up to everything and the replies cap down. */
function Pointer({ frame, posts, replies, press }: { frame: number; posts: number; replies: number; press: number }) {
  const toggleAt = { x: X + W - SWITCH.width / 2, y: SWITCH.top + SWITCH.height / 2 + 4 }
  const start = { x: toggleAt.x - 180, y: toggleAt.y + 90 }
  const postsY = POSTS.top + POSTS.height / 2
  const repliesY = REPLIES.top + REPLIES.height / 2
  const between = (from: { x: number; y: number }, to: { x: number; y: number }, a: number, b: number) => {
    const t = tween(frame, a, b, 0, 1, easeInOut)
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
  }

  let at: { x: number; y: number }
  if (frame < 430) at = between(start, toggleAt, 334, 366)
  else if (frame < 486) at = between(toggleAt, { x: capX(0.3), y: postsY }, 430, 474)
  else if (frame < 540) at = { x: capX(posts), y: postsY }
  else if (frame < 566) at = between({ x: capX(1), y: postsY }, { x: capX(0.3), y: repliesY }, 540, 560)
  else at = { x: capX(replies), y: repliesY }

  return (
    <Cursor
      x={at.x}
      y={at.y}
      press={Math.min(press, 1)}
      style={{ opacity: tween(frame, 326, 340) - tween(frame, 632, 650) }}
    />
  )
}
