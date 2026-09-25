import type { Metadata } from "next"
import { connection } from "next/server"

import { AccountsView } from "@/components/accounts-view"
import { AutoRefresh } from "@/components/auto-refresh"
import { Column, PageHeader } from "@/components/page"
import { Sidebar } from "@/components/sidebar"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { getDefaultRatio, listAccounts } from "@/lib/store"

export const metadata: Metadata = { title: "Accounts" }

export default async function AccountsPage() {
  await connection()
  const accounts = listAccounts()

  return (
    <>
      <Column>
        <PageHeader
          title="Accounts"
          subtitle={accounts.length > 0 ? `${accounts.length.toLocaleString("en")} you follow` : undefined}
        />
        {accounts.length > 0 ? (
          <AccountsView accounts={accounts} defaultRatio={getDefaultRatio()} />
        ) : (
          <Empty className="flex-1">
            <AutoRefresh />
            <EmptyHeader>
              <EmptyTitle>No accounts yet</EmptyTitle>
              <EmptyDescription>
                The accounts you follow show up here once the worker has read your following list. The light at the
                bottom of the menu shows how it&apos;s going.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Column>
      <Sidebar />
    </>
  )
}
