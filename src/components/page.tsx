import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** The middle column, 600px wide like X's timeline. */
export function Column({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh w-full max-w-[600px] min-w-0 flex-col sm:border-x max-sm:pb-[53px]">
      {children}
    </main>
  )
}

/** A column's sticky top bar, see-through and blurred as on X, with an optional back arrow. */
export function PageHeader({
  title,
  subtitle,
  back,
  children,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  /** Where the back arrow goes. */
  back?: string
  /** Rows under the title, such as tabs. */
  children?: ReactNode
}) {
  return (
    <div className="sticky top-0 z-30 bg-background/65 backdrop-blur-md">
      {title && (
        <div className="flex h-[53px] items-center gap-6 px-4">
          {back && (
            <Link
              href={back}
              aria-label="Back"
              className="-ml-2 flex size-[34px] shrink-0 items-center justify-center rounded-full transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeftIcon className="size-5" aria-hidden />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="flex min-w-0 items-center gap-1 text-xl leading-6 font-bold">{title}</h1>
            {subtitle && <p className="truncate text-[13px] leading-4 text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

/** A row of X-style tabs: equal widths, the current one bold and underlined in blue. */
export function Tabs({ label, links = false, children }: { label: string; links?: boolean; children: ReactNode }) {
  const Tag = links ? "nav" : "div"
  return (
    <Tag aria-label={label} role={links ? undefined : "group"} className="flex border-b">
      {children}
    </Tag>
  )
}

const tabClass = (active: boolean) =>
  cn(
    "flex h-[53px] flex-1 justify-center px-4 transition-colors outline-none hover:bg-hover",
    "focus-visible:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
  )

function TabLabel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span className="relative flex items-center">
      {children}
      {active && (
        <span className="absolute bottom-0 left-1/2 h-1 w-full min-w-14 -translate-x-1/2 rounded-full bg-signal" />
      )}
    </span>
  )
}

export function TabLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
      <TabLabel active={active}>{children}</TabLabel>
    </Link>
  )
}

export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={tabClass(active)}>
      <TabLabel active={active}>{children}</TabLabel>
    </button>
  )
}
