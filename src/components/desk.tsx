/** Stub height for accounts that post almost nothing, so every channel still shows. */
const MIN_CHANNEL = 0.05

export type Channel = {
  /** Posts a day, at the account's recent pace. */
  perDay: number
  /** Its fader: the share of those posts that reaches the feed. */
  ratio: number
  /** False until the worker has read the account, so its pace is unknown. */
  read: boolean
}

/**
 * Every account you follow side by side, busiest first, like the channels of a
 * mixing desk. A channel's height is how much the account posts; its lit part is
 * how much of that its fader lets into your feed.
 */
export function Desk({ channels, className }: { channels: Channel[]; className?: string }) {
  const sorted = channels.toSorted((a, b) => Number(b.read) - Number(a.read) || b.perDay - a.perDay)
  const busiest = sorted[0]?.read ? sorted[0].perDay : 0
  let full = ""
  let lit = ""
  let unread = ""
  sorted.forEach((channel, i) => {
    const bar = (height: number) => `M${i + 0.15} 1V${1 - height}H${i + 0.85}V1Z`
    if (!channel.read) {
      unread += bar(MIN_CHANNEL)
      return
    }
    // Square root, so quiet accounts stay visible next to ones posting dozens a day.
    const height = Math.max(busiest > 0 ? Math.sqrt(channel.perDay / busiest) : 0, MIN_CHANNEL)
    full += bar(height)
    if (channel.ratio > 0) lit += bar(height * Math.sqrt(channel.ratio))
  })

  return (
    <figure className={className} aria-hidden>
      <svg
        viewBox={`0 0 ${Math.max(sorted.length, 1)} 1`}
        preserveAspectRatio="none"
        className="block h-16 w-full sm:h-20"
      >
        <path d={full} className="fill-input" />
        <path d={unread} className="fill-border" />
        <path d={lit} className="fill-signal" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[13px] text-muted-foreground">
        <span>busiest</span>
        <span>{unread ? "not read yet" : "quietest"}</span>
      </figcaption>
    </figure>
  )
}
