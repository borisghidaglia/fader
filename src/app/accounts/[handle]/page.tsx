import { LockIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import { AccountTuner } from "@/components/account-tuner"
import { Column, PageHeader } from "@/components/page"
import { Sidebar } from "@/components/sidebar"
import { VerifiedBadge } from "@/components/tweet/tweet-card"
import { formatRate } from "@/lib/format"
import { accountTweets, getAccountByHandle, getDefaultRatio } from "@/lib/store"
import type { Account } from "@/lib/types"

export async function generateMetadata({ params }: PageProps<"/accounts/[handle]">): Promise<Metadata> {
  const { handle } = await params
  return { title: `@${handle}` }
}

export default async function AccountPage({ params }: PageProps<"/accounts/[handle]">) {
  await connection()
  const { handle } = await params
  const account = getAccountByHandle(handle)
  if (!account) notFound()

  return (
    <>
      <Column>
        <PageHeader
          back="/accounts"
          title={
            <>
              <span className="truncate">{account.name}</span>
              {account.verified && <VerifiedBadge className="size-5" />}
              {account.protected && <LockIcon className="size-[18px] shrink-0" role="img" aria-label="Protected account" />}
            </>
          }
          subtitle={pace(account)}
        />
        <AccountTuner account={account} tweets={accountTweets(account.id)} defaultRatio={getDefaultRatio()} />
      </Column>
      <Sidebar />
    </>
  )
}

/** Under the name, where X puts the post count. */
function pace(account: Account) {
  if (account.lastSyncedAt === null) return "Not read yet"
  if (account.perDay === 0) return "No posts lately"
  return `${account.perDay < 0.1 ? "Under 0.1" : formatRate(account.perDay)} posts a day`
}
