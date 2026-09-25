"use client"

import { Slider } from "@base-ui/react/slider"

import type { Bar } from "@/lib/curve"
import { describeRatio } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Stub height for bars of posts nobody engaged with, so they still show up. */
const MIN_BAR = 0.07

/**
 * A slider from 0 (mute) to 1 (everything). Its track is the account's recent
 * posts ranked best first, one bar each; the bars left of the thumb are the ones
 * that make it into your feed.
 */
export function Fader({
  value,
  onValueChange,
  onValueCommitted,
  curve,
  label,
  size = "default",
  className,
}: {
  value: number
  onValueChange: (value: number) => void
  onValueCommitted?: (value: number) => void
  /** Best post first. Empty draws a plain line. */
  curve: Bar[]
  /** Accessible name, e.g. "Show from @jack". */
  label: string
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  return (
    <Slider.Root
      value={value}
      onValueChange={(next) => onValueChange(next)}
      onValueCommitted={(next) => onValueCommitted?.(next)}
      min={0}
      max={1}
      step={0.01}
      largeStep={0.1}
      // Keep the cap inside the track at 0 and 1 instead of hanging over the edge.
      thumbAlignment="edge"
      className={cn("w-full", className)}
    >
      <Slider.Control
        className={cn(
          "relative flex w-full touch-none items-center select-none",
          // On touch screens only the cap is grabbable, so a list of faders still scrolls.
          "pointer-coarse:pointer-events-none",
          { sm: "h-7", default: "h-9", lg: "h-14" }[size],
        )}
      >
        <Slider.Track className="relative h-full w-full">
          {curve.length > 0 ? <Bars curve={curve} value={value} /> : <Line value={value} />}
          <Slider.Thumb
            getAriaLabel={() => label}
            getAriaValueText={(_, v) => describeRatio(v)}
            className={cn(
              // A fader cap: a white pill, set off from the bars by a black edge.
              "rounded-full bg-foreground ring-2 ring-background transition-transform",
              "outline-none focus-visible:ring-signal data-dragging:scale-x-125 data-dragging:cursor-grabbing",
              // A finger-sized grab area around the narrow cap.
              "pointer-events-auto touch-none before:absolute before:inset-y-0 before:-inset-x-4",
              { sm: "h-7 w-1.5", default: "h-9 w-1.5", lg: "h-14 w-2" }[size],
            )}
          />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  )
}

function Bars({ curve, value }: { curve: Bar[]; value: number }) {
  const n = curve.length
  let lit = ""
  let unlit = ""
  curve.forEach((bar, i) => {
    const h = Math.max(bar.height, MIN_BAR)
    const rect = `M${i + 0.18} 1V${1 - h}H${i + 0.82}V1Z`
    // The feed's rule, so the lit bars are exactly what gets through (ties included).
    if (bar.top <= value) lit += rect
    else unlit += rect
  })

  return (
    <svg
      viewBox={`0 0 ${n} 1`}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      <path d={unlit} className="fill-input" />
      <path d={lit} className="fill-signal" />
    </svg>
  )
}

function Line({ value }: { value: number }) {
  return (
    <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-input" aria-hidden>
      <div className="h-full rounded-full bg-signal" style={{ width: `${value * 100}%` }} />
    </div>
  )
}
