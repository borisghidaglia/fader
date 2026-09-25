import { Fragment } from "react"
import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion"

import { Avatar } from "../components/avatar"
import { Reveal, useEnter } from "../components/reveal"
import { Track } from "../components/track"
import { at, title } from "../styles"
import { color, describeRatio, easeInOut, formatRate, monthOfPosts, ranked, sans, tween } from "../theme"

/** Fader's default for accounts you haven't set yourself. */
const DEFAULT = 0.1

type Account = {
  name: string
  hue: number
  perDay: number
  target: number
  /** Replies on a fader of their own: where it ends up. */
  replies?: number
}

const accounts: Account[] = [
  { name: "Close friend", hue: 330, perDay: 3, target: 1 },
  { name: "Quiet expert", hue: 150, perDay: 1, target: 1 },
  { name: "Prolific founder", hue: 24, perDay: 38, target: 1, replies: 0.1 },
  { name: "Breaking news", hue: 200, perDay: 120, target: 0.05 },
  { name: "Hot takes", hue: 270, perDay: 25, target: 0 },
]

const ROW_WIDTH = 1360
const TRACK_WIDTH = 640
const ROW = 96
const SPLIT_ROW = 140
/** Room for "Posts" and "Replies" before a split row's tracks. */
const KIND_LABEL = 112

/** A list of accounts, each tuned from the default to its own setting. */
export function EveryAccount() {
  return (
    <AbsoluteFill>
      <div style={{ ...at(80, 70), ...title }}>
        <Reveal text="One fader per person." />{" "}
        <Reveal text="Tune it as you go." start={14} style={{ color: color.muted }} />
      </div>
      <div
        style={{
          ...at(80, 176, ROW_WIDTH),
          border: `1px solid ${color.xBorder}`,
          borderRadius: 24,
          overflow: "hidden",
          background: color.bg,
        }}
      >
        {accounts.map((account, i) => (
          <Row key={account.name} {...account} index={i} />
        ))}
      </div>
    </AbsoluteFill>
  )
}

function Row({ name, hue, perDay, target, replies, index }: Account & { index: number }) {
  const frame = useCurrentFrame()
  const enter = useEnter(22 + index * 6, 30, 16)
  const heights = ranked(monthOfPosts(name, 26))

  const start = 86 + index * 24
  const move = tween(frame, start, start + 44, 0, 1, easeInOut)
  const value = DEFAULT + (target - DEFAULT) * move
  // Grey while it follows the default, blue once it's set, as in Fader.
  const tuned = tween(frame, start, start + 12)
  const readout = (to: number) => interpolateColors(tuned, [0, 1], [color.xMuted, to > 0 ? color.blue : color.xMuted])

  return (
    <div
      style={{
        ...enter,
        display: "flex",
        alignItems: "center",
        gap: 28,
        height: replies === undefined ? ROW : SPLIT_ROW,
        padding: "0 32px",
        borderTop: index > 0 ? `1px solid ${color.xBorder}` : undefined,
        fontFamily: sans,
      }}
    >
      <Avatar name={name} hue={hue} size={56} />
      <div style={{ width: 280, lineHeight: 1.25 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: color.xText, letterSpacing: "-0.02em" }}>{name}</div>
        <div style={{ fontSize: 20, color: color.xMuted }}>
          {perDay} {perDay === 1 ? "post" : "posts"} a day
        </div>
      </div>
      {replies === undefined ? (
        <>
          <Track heights={heights} value={value} width={TRACK_WIDTH} height={56} capWidth={8} />
          <div style={{ flex: 1, textAlign: "right", lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: readout(target), letterSpacing: "-0.02em" }}>
              {describeRatio(value)}
            </div>
            <div style={{ fontSize: 20, color: color.xMuted }}>
              {value > 0.005 ? `≈${formatRate(perDay * value)} a day` : "none"}
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: `${KIND_LABEL}px ${TRACK_WIDTH - KIND_LABEL}px`, alignItems: "center", rowGap: 12 }}>
            {[
              { kind: "Posts", heights: ranked(monthOfPosts(`${name}-posts`, 18)), value },
              { kind: "Replies", heights: ranked(monthOfPosts(`${name}-replies`, 26)), value: DEFAULT + (replies - DEFAULT) * move },
            ].map((fader) => (
              <Fragment key={fader.kind}>
                <span style={{ fontSize: 20, color: color.xMuted }}>{fader.kind}</span>
                <Track heights={fader.heights} value={fader.value} width={TRACK_WIDTH - KIND_LABEL} height={44} capWidth={8} />
              </Fragment>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              display: "grid",
              rowGap: 12,
              textAlign: "right",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: "44px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <div style={{ color: readout(target) }}>{describeRatio(value)}</div>
            <div style={{ color: readout(replies) }}>{describeRatio(DEFAULT + (replies - DEFAULT) * move)}</div>
          </div>
        </>
      )}
    </div>
  )
}
