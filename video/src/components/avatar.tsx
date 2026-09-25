import { sans } from "../theme"

/** A made-up account's avatar: a gradient disc with an initial. */
export function Avatar({ name, hue, size }: { name: string; hue: number; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        background: `linear-gradient(135deg, hsl(${hue} 80% 62%), hsl(${hue + 50} 75% 42%))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: sans,
        fontWeight: 600,
        fontSize: size * 0.42,
      }}
    >
      {name[0]}
    </div>
  )
}
