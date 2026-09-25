import Link from "next/link"

import { Column } from "@/components/page"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export default function NotFound() {
  return (
    <Column>
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyTitle>Not here</EmptyTitle>
          <EmptyDescription>
            Nothing at this address. If you were looking for an account, it may not be one you follow.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href="/accounts" className={buttonVariants({ variant: "signal", size: "lg" })}>
            Browse accounts
          </Link>
        </EmptyContent>
      </Empty>
    </Column>
  )
}
