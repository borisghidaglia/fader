import { getStaticFiles, Html5Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion"

import { valueAt as endCardFader } from "./scenes/end-card"

/**
 * The soundtrack, public/music/glass-morning.mp3. It's kept out of git: its license
 * doesn't let us share the file itself, only the video made with it.
 *
 * 120 BPM in F minor, over a 4-bar loop of chords, so bars four apart sound alike and
 * a cut between them goes unheard. It drops into its groove at 24.126 s.
 */
const FILE = "music/glass-morning.mp3"
const TRACK = staticFile(FILE)
const DROP = 24.126
const BAR = (4 * 60) / 119.956
/** Where bar `k` starts, in seconds, counting from the drop. */
const bar = (k: number) => DROP + k * BAR
/** How loud it plays, under the sound effects. */
const LEVEL = 0.5
/** Each cut crossfades over the few frames before its bar line. */
const XFADE = 3

/**
 * The track cut to the scenes, on its bar lines. It lands on each scene mid-handoff,
 * as the scene appears, and the scene lengths in video.tsx keep whole bars between them.
 */
export function Music({ flood, faders, myFeed, endCard }: { flood: number; faders: number; myFeed: number; endCard: number }) {
  const { fps, durationInFrames } = useVideoConfig()
  // Without the track, as in a fresh clone, the video plays with its sound effects only.
  if (!getStaticFiles().some((file) => file.name === FILE)) return null
  const bars = (n: number) => Math.round(n * BAR * fps)
  const flooding = flood + 12
  const drop = faders + 12
  const lift = myFeed + 12

  // The end card's fader has the last word: all the way up until it comes down, fading the music out.
  // Squared, as a volume fader is heard in decibels: halfway down is about -12 dB.
  const turnedDown = (frame: number) => endCardFader(frame - endCard) ** 2

  // Where each stretch starts in the video, and where in the track it plays from.
  const cuts = [
    // The build, under way as the video opens. Its second, brighter phrase starts with the flood.
    { at: 0, from: bar(-4) - flooding / fps },
    // The build stops, and the intro's pad plays a bar while the first fader slides up.
    { at: drop - bars(2), from: bar(-11) },
    // The silent bar as the second fader slides down, then its riser into the drop.
    { at: drop - bars(1), from: bar(-1) },
    // Eight bars of groove, then the bar leading into its fullest part, which plays from your feed on.
    { at: lift - bars(1), from: bar(11) },
    // Its bar 16 sounds like bar 12, so it goes back four bars there and plays on past
    // where the track ends, while the end card is read.
    { at: lift + bars(4), from: bar(12) },
  ]

  return cuts.map((cut, i) => {
    const last = i === cuts.length - 1
    const until = last ? durationInFrames : cuts[i + 1].at
    // After the first, each starts a little early, to fade in under the one before.
    const lead = i === 0 ? 0 : XFADE
    const frames = until - cut.at + lead
    const fadeIn = i === 0 ? 30 : XFADE
    const fadeOut = last ? 10 : XFADE
    return (
      <Sequence key={i} from={cut.at - lead} durationInFrames={frames} name={`music ${i + 1}`} layout="none">
        <Html5Audio
          src={TRACK}
          trimBefore={Math.round(cut.from * fps) - lead}
          volume={(f) =>
            LEVEL *
            interpolate(f, [0, fadeIn], [0, 1], { extrapolateRight: "clamp" }) *
            interpolate(f, [frames - fadeOut, frames], [1, 0], { extrapolateLeft: "clamp" }) *
            turnedDown(cut.at - lead + f)
          }
        />
      </Sequence>
    )
  })
}
