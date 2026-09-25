import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion"

import { Avatar } from "../components/avatar"
import { Reveal, useEnter } from "../components/reveal"
import { at, label, title } from "../styles"
import { color, easeInOut, frame as box, mono, sans, tween } from "../theme"

/** One day from someone you follow. Two of these never reach your Following tab. */
const said = [
  { kind: "Post", ago: "1h", line: 0.86, arrives: true },
  { kind: "Reply", ago: "2h", line: 0.58, arrives: false },
  { kind: "Post", ago: "4h", line: 0.74, arrives: true },
  { kind: "Reply", ago: "5h", line: 0.66, arrives: true },
  { kind: "Post", ago: "7h", line: 0.8, arrives: false },
]

const LEFT = 80
const RIGHT = 780
const CARD_WIDTH = 660
const CARD_TOP = 236
const HEADER = 76
const ROW = 84
const FLY = 44

/** The problem: following someone doesn't get you what they say, even on Recent. */
export function Missed() {
  const frame = useCurrentFrame()
  const leftCard = useEnter(34)
  const rightCard = useEnter(46)

  return (
    <AbsoluteFill>
      <div style={{ ...at(80, 56), ...title, fontSize: 64 }}>
        <div>
          <Reveal text="You follow someone." />
        </div>
        <div style={{ color: color.muted }}>
          <Reveal text="You still miss some of what they say." start={16} />
        </div>
      </div>

      <Card x={LEFT} style={leftCard}>
        <div style={{ ...label, fontSize: 18 }}>Everything they said today</div>
      </Card>

      <Card x={RIGHT} style={rightCard}>
        <div style={{ fontFamily: sans, fontSize: 30, fontWeight: 700, color: color.xText, letterSpacing: "-0.02em" }}>
          Following
        </div>
        <Recent />
      </Card>

      {said.map((item, i) => {
        const shown = tween(frame, 52 + i * 8, 76 + i * 8)
        // Once they're all there, each heads for the Following tab.
        const start = 118 + i * 14
        const p = tween(frame, start, start + FLY, 0, 1, easeInOut)
        const slot = said.slice(0, i).filter((s) => s.arrives).length
        const lost = item.arrives ? 0 : tween(p, 0.2, 0.7)
        // What never arrived stays dim where it was said.
        const missed = item.arrives ? 0 : tween(frame, start + FLY, start + FLY + 24)

        return (
          <div key={i}>
            <Row item={item} x={LEFT} y={CARD_TOP + HEADER + i * ROW} style={{ opacity: shown * (1 - 0.6 * missed) }} />
            {p > 0 && (
              <Row
                item={item}
                x={LEFT + (RIGHT - LEFT) * p}
                y={CARD_TOP + HEADER + (i + (slot - i) * p) * ROW}
                style={{
                  opacity: 1 - lost,
                  filter: `blur(${lost * 14}px)`,
                  background: color.bg,
                  boxShadow: p < 1 ? `0 24px 60px rgba(0,0,0,${0.6 * Math.sin(Math.PI * p)})` : undefined,
                  transform: `scale(${1 + 0.03 * Math.sin(Math.PI * p)})`,
                }}
              />
            )}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

function Card({ x, style, children }: { x: number; style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      style={{
        ...style,
        position: "absolute",
        left: box.left + x,
        top: box.top + CARD_TOP,
        width: CARD_WIDTH,
        height: HEADER + said.length * ROW,
        border: `1px solid ${color.xBorder}`,
        borderRadius: 20,
      }}
    >
      <div
        style={{
          height: HEADER,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${color.xBorder}`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** X's choice for the Following tab, set to Recent. */
function Recent() {
  const frame = useCurrentFrame()
  const on = tween(frame, 70, 86)
  return (
    <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, border: `1px solid ${color.xBorder}` }}>
      {["Recent", "Popular"].map((option, i) => (
        <div
          key={option}
          style={{
            padding: "6px 16px",
            borderRadius: 999,
            fontFamily: sans,
            fontSize: 20,
            fontWeight: 600,
            background: i === 0 ? `rgba(255,255,255,${on})` : "transparent",
            color: i === 0 ? interpolateColors(on, [0, 1], [color.xMuted, "#000000"]) : color.xMuted,
          }}
        >
          {option}
        </div>
      ))}
    </div>
  )
}

function Row({
  item,
  x,
  y,
  style,
}: {
  item: (typeof said)[number]
  x: number
  y: number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: box.left + x + 1,
        top: box.top + y,
        width: CARD_WIDTH - 2,
        height: ROW,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        fontFamily: sans,
        ...style,
      }}
    >
      <Avatar name="Close friend" hue={330} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 24, lineHeight: 1.2 }}>
          <span style={{ fontWeight: 700, color: color.xText }}>Close friend</span>
          <span style={{ color: color.xMuted }}>· {item.ago}</span>
        </div>
        <div style={{ marginTop: 11, height: 12, width: `${item.line * 100}%`, borderRadius: 6, background: color.xBorder }} />
      </div>
      <span
        style={{
          fontFamily: mono,
          fontSize: 16,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: color.xMuted,
          padding: "3px 10px",
          border: `1px solid ${color.xBorder}`,
          borderRadius: 999,
        }}
      >
        {item.kind}
      </span>
    </div>
  )
}
