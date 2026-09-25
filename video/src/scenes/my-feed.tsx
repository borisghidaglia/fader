import { AbsoluteFill, random, useCurrentFrame } from "remotion"

import { Reveal } from "../components/reveal"
import { at, label, title } from "../styles"
import { color, tween } from "../theme"

const WIDTH = 1360
const HEIGHT = 300

/**
 * Made-up but typical: 180 accounts, a few posting all day and a long quiet tail.
 * Most stay on the default; friends and quiet experts get everything, some are muted.
 */
const desk = (() => {
  const channels = Array.from({ length: 180 }, (_, i) => {
    const perDay = 70 * Math.pow(i + 1, -0.85) * (0.7 + 0.6 * random(`pace-${i}`))
    const r = random(`fader-${i}`)
    const ratio =
      i < 3 ? 0.05 : r < 0.08 ? 0 : perDay < 1.5 && r < 0.35 ? 1 : r < 0.3 ? 0.15 + 0.2 * random(`set-${i}`) : 0.1
    return { perDay, ratio }
  }).sort((a, b) => b.perDay - a.perDay)
  const total = channels.reduce((sum, c) => sum + c.perDay, 0)
  const shown = channels.reduce((sum, c) => sum + c.perDay * c.ratio, 0)
  return { channels, totalPerDay: Math.round(total), shownPerDay: Math.round(shown) }
})()
const busiest = desk.channels[0].perDay

/**
 * Every account you follow as a channel, busiest first. A channel's height is how
 * much the account posts; its blue part is what its faders let through.
 */
export function MyFeed() {
  const frame = useCurrentFrame()
  const lit = tween(frame, 104, 164)
  const shown = Math.round(desk.shownPerDay * lit)
  const slot = WIDTH / desk.channels.length

  return (
    <AbsoluteFill>
      <div style={{ ...at(80, 60), ...title, fontSize: 60 }}>
        <div style={{ color: color.muted }}>
          <Reveal text={`${desk.totalPerDay} posts a day from the people you follow.`} />
        </div>
        <div style={{ opacity: tween(frame, 92, 108), fontVariantNumeric: "tabular-nums" }}>
          <span style={{ color: color.blue }}>{shown}</span> make it to your feed. Your faders decide.
        </div>
      </div>

      <div style={{ ...at(80, 310, WIDTH), height: HEIGHT }}>
        {desk.channels.map((channel, i) => {
          const height = Math.max(Math.sqrt(channel.perDay / busiest), 0.02) * HEIGHT
          const grow = tween(frame, 12 + i * 0.32, 34 + i * 0.32)
          const common = { position: "absolute", bottom: 0, left: i * slot + slot * 0.15, width: slot * 0.7 } as const
          return (
            <div key={i}>
              <div style={{ ...common, height: height * grow, background: color.unlit }} />
              <div style={{ ...common, height: height * Math.sqrt(channel.ratio) * lit, background: color.blue }} />
            </div>
          )
        })}
      </div>

      <div style={{ ...at(80, 634), ...label, display: "flex", justifyContent: "space-between", opacity: tween(frame, 40, 60) }}>
        <span>Everyone you follow</span>
        <span>Busiest → quietest</span>
      </div>
    </AbsoluteFill>
  )
}
