import { SlidersVerticalIcon } from "lucide-react"
import Link from "next/link"
import { connection } from "next/server"

import { AutoRefresh } from "@/components/auto-refresh"
import { FeedList } from "@/components/feed-list"
import { Column, PageHeader, TabLink, Tabs } from "@/components/page"
import { Sidebar } from "@/components/sidebar"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { countFollowedAccounts, countSyncedTweets, feedPage, toFeedFilter, type FeedFilter } from "@/lib/store"

const tabs: { filter: FeedFilter; label: string }[] = [
  { filter: "all", label: "All" },
  { filter: "posts", label: "Posts" },
  { filter: "replies", label: "Replies" },
]

export default async function FeedPage({ searchParams }: PageProps<"/">) {
  await connection()
  const { show } = await searchParams
  const filter = toFeedFilter(show)
  const items = feedPage({ filter })

  return (
    <>
      <Column>
        <h1 className="sr-only">Feed</h1>
        <PageHeader>
          {/* On phones, as in X's app, the app's name sits above the tabs. */}
          <p className="flex h-[53px] items-center justify-center text-xl font-extrabold tracking-tight sm:hidden">
            Fader
          </p>
          <Tabs label="Show" links>
            {tabs.map((tab) => (
              <TabLink
                key={tab.filter}
                href={tab.filter === "all" ? "/" : `/?show=${tab.filter}`}
                active={tab.filter === filter}
              >
                {tab.label}
              </TabLink>
            ))}
          </Tabs>
        </PageHeader>

        {items.length > 0 ? (
          // A new first post means a fresh list: reset scroll-loaded pages and the "new" count.
          <FeedList key={`${filter}-${items[0].id}`} initialItems={items} filter={filter} />
        ) : (
          <FeedEmpty filter={filter} />
        )}
      </Column>
      <Sidebar />
    </>
  )
}

function FeedEmpty({ filter }: { filter: FeedFilter }) {
  const accounts = countFollowedAccounts()
  const tweets = countSyncedTweets()

  if (accounts === 0) {
    return (
      <Empty className="flex-1">
        <AutoRefresh />
        <EmptyHeader>
          <EmptyTitle>Connect your X session</EmptyTitle>
          <EmptyDescription>
            Fader reads X the way your browser does, with your session cookies. Copy{" "}
            <Code>auth_token</Code>, <Code>ct0</Code> and <Code>twid</Code> from x.com (DevTools → Application →
            Cookies) into <Code>.env.local</Code>, then run <Code>pnpm dev</Code>. The feed fills in as your
            following list syncs.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (tweets === 0) {
    return (
      <Empty className="flex-1">
        <AutoRefresh />
        <EmptyHeader>
          <EmptyTitle>Your feed is filling up</EmptyTitle>
          <EmptyDescription>
            Reading the {accounts.toLocaleString("en")} accounts you follow. Posts show up here as they arrive.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyTitle>{filter === "all" ? "Every fader is down" : `No ${filter} make it through`}</EmptyTitle>
        <EmptyDescription>
          {filter === "all"
            ? "None of the synced posts pass your faders. Raise a few to let posts in."
            : `Your faders let nothing through that's a ${filter === "posts" ? "post" : "reply"}. Raise a few, or look at everything.`}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Link href="/accounts" className={buttonVariants({ variant: "signal", size: "lg" })}>
          <SlidersVerticalIcon aria-hidden />
          Adjust faders
        </Link>
        {filter !== "all" && (
          <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Show all
          </Link>
        )}
      </EmptyContent>
    </Empty>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>
}
