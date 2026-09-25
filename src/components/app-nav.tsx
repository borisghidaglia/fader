"use client"

import { HouseIcon, SlidersVerticalIcon, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { SyncStatus } from "@/components/sync-status"
import { cn } from "@/lib/utils"

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Feed", icon: HouseIcon },
  { href: "/accounts", label: "Accounts", icon: SlidersVerticalIcon },
]

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

/** X's left column: the app's name, navigation, and the sync status where X keeps your account. */
export function SideNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col items-center px-2 py-1 sm:flex xl:w-[275px] xl:items-start xl:px-3">
      <Link
        href="/"
        className="flex h-[52px] items-center rounded-full px-2 text-xl font-extrabold tracking-tight transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring xl:px-3 xl:text-[23px]"
      >
        Fader
      </Link>

      <nav aria-label="Main" className="flex flex-col items-center xl:items-start">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="group flex py-1 outline-none"
            >
              <span className="flex items-center gap-5 rounded-full p-3 transition-colors group-hover:bg-hover group-focus-visible:ring-2 group-focus-visible:ring-ring xl:pr-6">
                <Icon className="size-[26px]" strokeWidth={active ? 2.5 : 1.75} aria-hidden />
                <span className={cn("hidden text-xl leading-6 xl:inline", active && "font-bold")}>{label}</span>
              </span>
            </Link>
          )
        })}
      </nav>

      <SyncStatus variant="rail" className="mt-auto mb-3" />
    </header>
  )
}

/** On phones the navigation moves to a bar at the bottom, as in X's app. */
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[53px] border-t bg-background/85 backdrop-blur-md sm:hidden"
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 items-center justify-center outline-none focus-visible:bg-hover"
          >
            <Icon className="size-[26px]" strokeWidth={active ? 2.5 : 1.75} aria-hidden />
          </Link>
        )
      })}
      <SyncStatus variant="tab" className="flex-1" />
    </nav>
  )
}

