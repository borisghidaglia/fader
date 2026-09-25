const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** How a fader position reads: "Muted", "Top 20%", "Everything". */
export function describeRatio(ratio: number): string {
  if (ratio <= 0) return "Muted"
  if (ratio >= 1) return "Everything"
  return `Top ${Math.max(1, Math.round(ratio * 100))}%`
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })

export function formatCount(n: number): string {
  return compact.format(n)
}

export function formatPerDay(perDay: number): string {
  if (perDay === 0) return "0/day"
  if (perDay < 0.1) return "<0.1/day"
  return `${perDay < 10 ? perDay.toFixed(1) : Math.round(perDay)}/day`
}

/** A rate without its unit: "3.7", "69", "1,204". */
export function formatRate(perDay: number): string {
  return perDay < 10 ? perDay.toFixed(1) : Math.round(perDay).toLocaleString("en")
}

/** "now", "5m", "3h", "Sep 21", or "Sep 21, 2025" for other years. */
export function timeAgo(at: number, now = Date.now()): string {
  const elapsed = now - at
  if (elapsed < MINUTE) return "now"
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`
  const date = new Date(at)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

/** timeAgo as a phrase: "just now", "5m ago", "on Sep 21". */
export function ago(at: number, now = Date.now()): string {
  const t = timeAgo(at, now)
  return t === "now" ? "just now" : /^\d+[mh]$/.test(t) ? `${t} ago` : `on ${t}`
}

export function fullDate(at: number): string {
  return new Date(at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })
}

/** Rank as shown next to a tweet: "top 4%". */
export function describeRank(top: number): string {
  return `top ${Math.max(1, Math.round(top * 100))}%`
}
