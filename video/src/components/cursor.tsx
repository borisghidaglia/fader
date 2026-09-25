import type { CSSProperties } from "react"

/** A mouse pointer, its tip at (x, y). `press` from 0 to 1 squeezes it for a click. */
export function Cursor({ x, y, press = 0, style }: { x: number; y: number; press?: number; style?: CSSProperties }) {
  return (
    <svg
      width={34}
      height={40}
      viewBox="0 0 17 20"
      style={{
        position: "absolute",
        left: x - 3,
        top: y - 2,
        transform: `scale(${1 - 0.15 * press})`,
        transformOrigin: "3px 2px",
        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))",
        ...style,
      }}
    >
      <path
        d="M1.5 1 L1.5 16.2 L5.3 12.6 L7.9 18.6 L10.6 17.4 L8 11.5 L13.4 11.5 Z"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
    </svg>
  )
}
