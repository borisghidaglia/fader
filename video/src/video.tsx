import { linearTiming, TransitionSeries } from "@remotion/transitions"
import { AbsoluteFill } from "remotion"

import { Backdrop } from "./components/backdrop"
import { handoff } from "./components/handoff"
import { EndCard } from "./scenes/end-card"
import { EveryAccount } from "./scenes/every-account"
import { Faders } from "./scenes/faders"
import { Missed } from "./scenes/missed"
import { MyFeed } from "./scenes/my-feed"
import { SomeAndOthers } from "./scenes/some-and-others"
import { color, sans } from "./theme"

export const FPS = 60

const scenes = [
  { Scene: Missed, frames: 310 },
  { Scene: SomeAndOthers, frames: 220 },
  { Scene: Faders, frames: 680 },
  { Scene: EveryAccount, frames: 300 },
  { Scene: MyFeed, frames: 250 },
  { Scene: EndCard, frames: 200 },
]

const TRANSITION = 24

export const DURATION = scenes.reduce((sum, s) => sum + s.frames, 0) - TRANSITION * (scenes.length - 1)

export function Video() {
  return (
    <AbsoluteFill style={{ fontFamily: sans, color: color.fg }}>
      <Backdrop />
      <TransitionSeries>
        {scenes.flatMap(({ Scene, frames }, i) => [
          ...(i > 0
            ? [
                <TransitionSeries.Transition
                  key={`transition-${i}`}
                  presentation={handoff()}
                  timing={linearTiming({ durationInFrames: TRANSITION })}
                />,
              ]
            : []),
          <TransitionSeries.Sequence key={`scene-${i}`} durationInFrames={frames}>
            <Scene />
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
    </AbsoluteFill>
  )
}
