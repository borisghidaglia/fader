import { Html5Audio, Sequence, staticFile, useVideoConfig } from "remotion"

import lengths from "../public/sfx/lengths.json"

/** A sound from public/sfx (made by scripts/sfx.mts), played at frame `at` of a scene's own timeline. */
export type Cue = { at: number; sound: string; volume?: number }

/**
 * A fader's detents: a tick on each frame where the fader, moving along `value`
 * from frame `from` to `to`, lights or unlights one of `n` bars. Bar k is lit past
 * (k + 0.5) / n, as Track draws them.
 */
export function detents(value: (frame: number) => number, n: number, from: number, to: number, volume = 0.22): Cue[] {
  const lit = (frame: number) => Math.min(n, Math.max(0, Math.floor(value(frame) * n + 0.5)))
  const cues: Cue[] = []
  for (let frame = from + 1; frame <= to; frame++) {
    if (lit(frame) !== lit(frame - 1)) cues.push({ at: frame, sound: `detent-${frame % 3}`, volume })
  }
  return cues
}

/** How much louder than their cue volumes sound effects play, to sit over the music. */
const GAIN = 1.1

/** Plays cues on the current timeline. */
export function Sounds({ cues }: { cues: Cue[] }) {
  const { fps } = useVideoConfig()
  return cues.map((cue, i) => {
    const seconds = (lengths as Record<string, number>)[cue.sound]
    if (seconds === undefined) throw new Error(`No sound named ${cue.sound} in public/sfx. Run pnpm sfx.`)
    return (
      <Sequence key={i} from={Math.round(cue.at)} durationInFrames={Math.ceil(seconds * fps)} name={cue.sound} layout="none">
        <Html5Audio src={staticFile(`sfx/${cue.sound}.wav`)} volume={Math.min(1, (cue.volume ?? 1) * GAIN)} />
      </Sequence>
    )
  })
}
