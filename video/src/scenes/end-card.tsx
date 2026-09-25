import type { CSSProperties } from "react"
import { AbsoluteFill, useCurrentFrame } from "remotion"

import { Cross } from "../components/backdrop"
import { Reveal, useEnter } from "../components/reveal"
import { detents, type Cue } from "../sound"
import { label, title } from "../styles"
import { color, easeInOut, frame as content, mono, sans, tween } from "../theme"

const LINE = 560
const CAP = 14

/** Fader as it is on the left, the ask on the right, either side of a guide down the middle. */
const MIDDLE = content.left + content.width / 2
const COLUMN = 620
const GUTTER = 60

// When each part comes in: the two things that keep it from shipping as is, then the ask.
const TERMS = 100
const COST = 190
const ASK = 330
const DOWN = 470

/**
 * The fader starts all the way up, with the music playing. Once everything's said, it
 * comes down to only the best and takes the music down with it, to end the video.
 */
export const valueAt = (frame: number) => tween(frame, DOWN, DOWN + 90, 1, 0.15, easeInOut)

export const sounds: Cue[] = detents(valueAt, 12, DOWN, DOWN + 90, 0.14)

/** A column centred down the content frame. */
function column(left: number): CSSProperties {
  return {
    position: "absolute",
    left,
    top: content.top,
    width: COLUMN,
    height: content.height,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  }
}

const note: CSSProperties = {
  margin: 0,
  fontFamily: sans,
  fontSize: 27,
  fontWeight: 400,
  letterSpacing: "-0.015em",
  lineHeight: 1.4,
  color: color.muted,
}

const strong: CSSProperties = { color: color.fg, fontWeight: 500, whiteSpace: "nowrap" }

/**
 * Fader and where to find it, why it can't ship as it is, and an ask to X. The cost is
 * the maker's own feed: 270 accounts post 1,000 to 1,300 tweets a day. Ranking reads each
 * twice, new and once its engagement has settled, on different days, and X bills each
 * read at $0.005 a post: at least $300 a month, before reposts.
 */
export function EndCard() {
  const frame = useCurrentFrame()
  const guide = tween(frame, 0, 40, 0, 1, easeInOut)
  const line = useEnter(16, 30, 0)
  const tagline = useEnter(40)
  const link = useEnter(58)
  const terms = useEnter(TERMS)
  const cost = useEnter(COST)
  const value = valueAt(frame)
  const capX = CAP / 2 + value * (LINE - CAP)

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: MIDDLE,
          top: content.top,
          width: 1,
          height: content.height,
          background: color.guide,
          transform: `scaleY(${guide})`,
          transformOrigin: "top",
        }}
      />
      {[content.top, content.top + content.height].map((y) => (
        <div key={y} style={{ opacity: guide }}>
          <Cross x={MIDDLE} y={y} />
        </div>
      ))}

      <div style={column(MIDDLE - GUTTER - COLUMN)}>
        <Reveal
          text="Fader"
          style={{ fontFamily: sans, fontSize: 160, fontWeight: 700, letterSpacing: "-0.065em", lineHeight: 1, color: color.fg }}
        />
        <div style={{ ...line, position: "relative", width: LINE, height: 56, marginTop: 32 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 25, height: 6, borderRadius: 3, background: color.unlit }} />
          <div style={{ position: "absolute", left: 0, width: capX, top: 25, height: 6, borderRadius: 3, background: color.blue }} />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: capX - CAP / 2,
              width: CAP,
              height: 56,
              borderRadius: CAP,
              background: "#ffffff",
              boxShadow: `0 0 0 4px ${color.bg}`,
            }}
          />
        </div>
        <p style={{ ...tagline, margin: "36px 0 0", fontFamily: sans, fontSize: 32, fontWeight: 500, letterSpacing: "-0.03em", color: color.muted }}>
          A fader for every account you follow.
        </p>
        <div style={{ ...link, marginTop: 52 }}>
          <div style={label}>Working prototype</div>
          <div style={{ marginTop: 10, fontFamily: mono, fontSize: 24, color: color.fg }}>github.com/borisghidaglia/fader</div>
        </div>
        <p style={{ ...terms, ...note, marginTop: 44 }}>
          A demo only: it reads X as you, with your session cookies, <span style={strong}>outside X’s terms</span>.
        </p>
        <p style={{ ...cost, ...note, marginTop: 12 }}>
          On X’s API, @borisfyi, who follows 270 people, would pay <span style={strong}>at least $300 a month</span>.
        </p>
      </div>

      <div style={{ ...column(MIDDLE + GUTTER), ...title, fontSize: 100, lineHeight: 1.04 }}>
        <div>
          <Reveal text="X, please" start={ASK} />
        </div>
        <div>
          <Reveal text="build this." start={ASK + 6} />
        </div>
        <div style={{ color: color.muted, marginTop: 20 }}>
          <Reveal text="Even behind" start={ASK + 30} />
        </div>
        <div style={{ color: color.muted }}>
          <Reveal text="Premium." start={ASK + 36} />
        </div>
      </div>
    </AbsoluteFill>
  )
}
