import Link from "next/link"

import { AuthorAvatar, VerifiedBadge } from "@/components/tweet/tweet-card"
import { formatPerDay, formatRate } from "@/lib/format"
import { feedMix } from "@/lib/store"

/** X's right column, on wide screens: which accounts fill your feed, one click from their faders. */
export function Sidebar() {
  const mix = feedMix(5)

  return (
    <aside className="hidden w-[350px] shrink-0 lg:ml-[30px] lg:block">
      <div className="sticky top-0 flex flex-col gap-4 py-3">
        <section aria-labelledby="most-in-feed" className="overflow-hidden rounded-2xl border">
          <h2 id="most-in-feed" className="px-4 pt-3 text-xl leading-6 font-extrabold">
            Most in your feed
          </h2>
          <p className="px-4 pt-0.5 pb-2 text-muted-foreground">
            ≈{formatRate(mix.perDay)} posts a day get through your faders.
          </p>

          {mix.loudest.length > 0 ? (
            <ul>
              {mix.loudest.map((account) => (
                <li key={account.id}>
                  <Link
                    href={`/accounts/${account.handle}`}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-foreground/[0.03] focus-visible:bg-hover"
                  >
                    <AuthorAvatar name={account.name} src={account.avatarUrl} className="size-10" />
                    <span className="min-w-0 flex-1 leading-5">
                      <span className="flex min-w-0 items-center gap-0.5 font-bold">
                        <span className="truncate group-hover:underline">{account.name}</span>
                        {account.verified && <VerifiedBadge />}
                      </span>
                      <span className="block truncate text-muted-foreground">
                        @{account.handle} · ≈{formatPerDay(account.perDay)}
                      </span>
                    </span>
                    <span className="rounded-full bg-primary px-4 text-sm leading-8 font-bold text-primary-foreground transition-colors group-hover:bg-[#d7dbdc]">
                      Adjust
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-3 text-muted-foreground">Nothing gets through yet.</p>
          )}

          <Link
            href="/accounts"
            className="block px-4 py-4 text-signal transition-colors outline-none hover:bg-foreground/[0.03] focus-visible:bg-hover"
          >
            All accounts
          </Link>
        </section>

        <p className="px-4 text-[13px] leading-4 text-muted-foreground">
          Fader reads X slowly, with your session, and never posts, likes or follows.
        </p>
      </div>
    </aside>
  )
}
