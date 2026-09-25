import { linearTiming, TransitionSeries } from "@remotion/transitions"
import { AbsoluteFill } from "remotion"

import { Backdrop } from "./components/backdrop"
import { handoff } from "./components/handoff"
import { held, Paced, pacedFrame, type Hold } from "./components/paced"
import { Music } from "./music"
import * as endCard from "./scenes/end-card"
import * as everyAccount from "./scenes/every-account"
import * as faders from "./scenes/faders"
import * as flood from "./scenes/flood"
import * as missed from "./scenes/missed"
import * as myFeed from "./scenes/my-feed"
import * as someAndOthers from "./scenes/some-and-others"
import { Sounds, type Cue } from "./sound"
import { color, sans } from "./theme"

export const FPS = 60

/**
 * Each scene, its sounds and length, and where it pauses so there's time to read.
 * The lengths from the flood on keep whole bars of music between the scenes it lands on.
 */
const scenes: { Scene: () => React.ReactNode; sounds: Cue[]; frames: number; holds?: Hold[] }[] = [
  { Scene: missed.Missed, sounds: missed.sounds, frames: 340 },
  { Scene: flood.Flood, sounds: flood.sounds, frames: 398 },
  { Scene: someAndOthers.SomeAndOthers, sounds: someAndOthers.sounds, frames: 250 },
  {
    Scene: faders.Faders,
    sounds: faders.sounds,
    frames: 700,
    // After the bars grow, once they're sorted, after the first slide, before the split faders move.
    holds: [
      { at: 110, frames: 15 },
      { at: 212, frames: 15 },
      { at: 306, frames: 15 },
      { at: 476, frames: 15 },
    ],
  },
  { Scene: everyAccount.EveryAccount, sounds: everyAccount.sounds, frames: 368 },
  { Scene: myFeed.MyFeed, sounds: myFeed.sounds, frames: 264 },
  { Scene: endCard.EndCard, sounds: endCard.sounds, frames: 620 },
].map((scene) => ({ ...scene, frames: scene.frames + held(scene.holds ?? []) }))

const TRANSITION = 24

/** Where each scene starts: its handoff from the one before. */
const starts = scenes.map((_, i) => scenes.slice(0, i).reduce((sum, s) => sum + s.frames - TRANSITION, 0))
const startOf = (Scene: () => React.ReactNode) => starts[scenes.findIndex((s) => s.Scene === Scene)]

export const DURATION = scenes.reduce((sum, s) => sum + s.frames, 0) - TRANSITION * (scenes.length - 1)

export function Video() {
  return (
    <AbsoluteFill style={{ fontFamily: sans, color: color.fg }}>
      <Backdrop />
      <TransitionSeries>
        {scenes.flatMap(({ Scene, sounds, frames, holds = [] }, i) => [
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
            <Paced holds={holds}>
              <Scene />
            </Paced>
            {/* Outside the pauses, so a sound is never frozen mid-play, but timed as the scene's motion is. */}
            <Sounds cues={sounds.map((cue) => ({ ...cue, at: pacedFrame(holds, cue.at) }))} />
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
      <Music
        flood={startOf(flood.Flood)}
        faders={startOf(faders.Faders)}
        myFeed={startOf(myFeed.MyFeed)}
        endCard={startOf(endCard.EndCard)}
      />
    </AbsoluteFill>
  )
}
