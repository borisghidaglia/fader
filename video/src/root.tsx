import { Composition } from "remotion"

import { DURATION, FPS, Video } from "./video"

export function Root() {
  return <Composition id="Fader" component={Video} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
}
