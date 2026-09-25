"use client"

import { ArrowUpIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react"

import { loadFeedPage } from "@/app/actions"
import type { StatusResponse } from "@/app/api/status/route"
import { TweetCard } from "@/components/tweet/tweet-card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { usePoll } from "@/hooks/use-poll"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import type { FeedFilter } from "@/lib/store"
import type { FeedItem } from "@/lib/types"

const NEW_POSTS_POLL_MS = 30_000

/** The feed, loading older pages as you scroll and offering newer posts as they sync. */
export function FeedList({ initialItems, filter }: { initialItems: FeedItem[]; filter: FeedFilter }) {
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  const [items, setItems] = useState(initialItems)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loading, startLoading] = useTransition()
  const [newCount, setNewCount] = useState(0)
  const sentinel = useRef<HTMLDivElement>(null)

  function loadMore() {
    const last = items.at(-1)
    if (loading || done || failed || !last) return
    startLoading(async () => {
      try {
        const page = await loadFeedPage({ createdAt: last.createdAt, id: last.id }, filter)
        if (page.length === 0) return setDone(true)
        setItems((current) => {
          const seen = new Set(current.map((item) => item.id))
          return [...current, ...page.filter((item) => !seen.has(item.id))]
        })
      } catch {
        setFailed(true)
      }
    })
  }

  // Load the next page as the end of the list comes into view. Re-observing after
  // each page catches a sentinel that's still in view.
  const onSentinelVisible = useEffectEvent(loadMore)
  useEffect(() => {
    const element = sentinel.current
    if (!element || done || failed) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onSentinelVisible()
      },
      { rootMargin: "1500px 0px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [done, failed, items.length])

  const newest = initialItems[0].createdAt
  usePoll(
    async () => {
      const response = await fetch(`/api/status?since=${newest}&show=${filter}`, { cache: "no-store" })
      if (response.ok) setNewCount(((await response.json()) as StatusResponse).newPosts ?? 0)
    },
    NEW_POSTS_POLL_MS,
    { immediate: false },
  )

  const newPostsLabel = newCount === 1 ? "1 new post" : `${newCount} new posts`

  function showNewPosts() {
    setNewCount(0)
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })
    router.refresh()
  }

  return (
    <>
      {/* Always mounted: screen readers only announce changes to a live region that's already there. */}
      <p className="sr-only" aria-live="polite">
        {newCount > 0 && newPostsLabel}
      </p>
      {newCount > 0 && (
        // Below the sticky header: the tabs, plus the logo row on phones.
        <div className="sticky top-[53px] z-20 flex h-0 justify-center max-sm:top-[106px]">
          <Button variant="signal" onClick={showNewPosts} className="mt-3 shadow-menu">
            <ArrowUpIcon aria-hidden />
            {newPostsLabel}
          </Button>
        </div>
      )}

      <ol className="divide-y border-b">
        {items.map((item) => (
          <li key={item.id} className="[contain-intrinsic-size:auto_220px] [content-visibility:auto]">
            <TweetCard item={item} linkFader />
          </li>
        ))}
      </ol>

      <div ref={sentinel} className="flex min-h-24 items-center justify-center px-4 py-8">
        {failed ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            Couldn&apos;t load older posts.
            <Button variant="outline" size="sm" onClick={() => setFailed(false)}>
              Try again
            </Button>
          </div>
        ) : done ? (
          <p className="text-muted-foreground">That&apos;s everything synced so far</p>
        ) : (
          loading && <Spinner className="size-6 text-signal" />
        )}
      </div>
    </>
  )
}
