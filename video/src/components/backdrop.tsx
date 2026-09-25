import { AbsoluteFill } from "remotion"

import { color, frame } from "../theme"

const GUIDE_OVERHANG = 1

/** Black, a faint grid, and guide lines round the content with a cross at each corner. */
export function Backdrop() {
  const right = frame.left + frame.width
  const bottom = frame.top + frame.height

  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          backgroundPosition: `${frame.left}px ${frame.top}px`,
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 45%, black 20%, transparent 80%)",
        }}
      />
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 60% 45% at 50% 0%, rgba(255,255,255,0.07), transparent 70%)" }}
      />
      {[frame.left, right].map((x) => (
        <div key={`v${x}`} style={{ position: "absolute", left: x, top: 0, bottom: 0, width: GUIDE_OVERHANG, background: color.guide }} />
      ))}
      {[frame.top, bottom].map((y) => (
        <div key={`h${y}`} style={{ position: "absolute", top: y, left: 0, right: 0, height: GUIDE_OVERHANG, background: color.guide }} />
      ))}
      {[frame.left, right].flatMap((x) =>
        [frame.top, bottom].map((y) => <Cross key={`${x}-${y}`} x={x} y={y} />),
      )}
    </AbsoluteFill>
  )
}

function Cross({ x, y }: { x: number; y: number }) {
  const size = 22
  const line = { position: "absolute", background: "rgba(255,255,255,0.45)" } as const
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size }}>
      <div style={{ ...line, left: size / 2, top: 0, width: 1, height: size }} />
      <div style={{ ...line, top: size / 2, left: 0, height: 1, width: size }} />
    </div>
  )
}
