import { AbsoluteFill, useCurrentFrame } from "remotion"

import { Reveal, useEnter } from "../components/reveal"
import { label } from "../styles"
import { color, easeInOut, mono, sans, tween } from "../theme"

const LINE = 560
const CAP = 14

/** The name, one last fader move, and where to find it. */
export function EndCard() {
  const frame = useCurrentFrame()
  const line = useEnter(20, 30, 0)
  const tagline = useEnter(56)
  const link = useEnter(74)
  const value = tween(frame, 34, 96, 0, 0.72, easeInOut)
  const capX = CAP / 2 + value * (LINE - CAP)

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <Reveal
        text="Fader"
        style={{ fontFamily: sans, fontSize: 176, fontWeight: 700, letterSpacing: "-0.065em", lineHeight: 1, color: color.fg }}
      />
      <div style={{ ...line, position: "relative", width: LINE, height: 56, marginTop: 36 }}>
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
      <p style={{ ...tagline, margin: "44px 0 0", fontFamily: sans, fontSize: 38, fontWeight: 500, letterSpacing: "-0.03em", color: color.muted }}>
        A fader for every account you follow.
      </p>
      <p style={{ ...link, ...label, margin: "56px 0 0", display: "flex", gap: 20 }}>
        <span>Working prototype</span>
        <span style={{ color: color.faint }}>/</span>
        <span style={{ fontFamily: mono, textTransform: "none", letterSpacing: 0, color: color.fg }}>
          github.com/borisghidaglia/fader
        </span>
      </p>
    </AbsoluteFill>
  )
}
