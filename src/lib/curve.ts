/** Most bars a fader track draws; busier accounts are bucketed. */
const MAX_BARS = 40

/** One bar of a fader track. */
export type Bar = {
  /** 0–1, on a square-root scale so a single viral post doesn't flatten everything else. */
  height: number
  /**
   * Rank of the tweet it stands for, among the tweets on this track (`top`, or `kind_top`
   * on a posts or replies fader): lit when it's at or under the fader, the feed's own rule.
   */
  top: number
}

/**
 * A fader track: an account's recent tweets ranked best first, one bar per tweet,
 * or per bucket of tweets for busy accounts (drawn as the tweet in its middle).
 */
export function engagementCurve(
  rankedBestFirst: { score: number; top: number }[],
  maxBars = MAX_BARS,
): Bar[] {
  const n = rankedBestFirst.length
  if (n === 0) return []
  const max = Math.max(rankedBestFirst[0].score, 0)
  const bars = Math.min(n, maxBars)
  return Array.from({ length: bars }, (_, i) => {
    const { score, top } = rankedBestFirst[Math.floor(((i + 0.5) * n) / bars)]
    const height = max > 0 ? Math.sqrt(Math.max(score, 0) / max) : 0
    return { height: Math.round(height * 100) / 100, top }
  })
}
