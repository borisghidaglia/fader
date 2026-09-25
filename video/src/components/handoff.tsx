import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions"
import { AbsoluteFill } from "remotion"

import { easeInOut, tween } from "../theme"

type Props = Record<string, never>

/**
 * The outgoing scene lifts away into a blur before the next one fades in, so two
 * scenes' text never sits on top of each other over the shared backdrop.
 */
function Handoff({ children, presentationDirection, presentationProgress: p }: TransitionPresentationComponentProps<Props>) {
  if (presentationDirection === "exiting") {
    const t = tween(p, 0, 0.6, 0, 1, easeInOut)
    return (
      <AbsoluteFill style={{ opacity: 1 - t, transform: `translateY(${-16 * t}px)`, filter: `blur(${10 * t}px)` }}>
        {children}
      </AbsoluteFill>
    )
  }
  return <AbsoluteFill style={{ opacity: tween(p, 0.4, 1) }}>{children}</AbsoluteFill>
}

export const handoff = (): TransitionPresentation<Props> => ({ component: Handoff, props: {} })
