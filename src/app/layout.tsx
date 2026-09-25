import type { Metadata } from "next"

import { BottomNav, SideNav } from "@/components/app-nav"
import { SyncStatusProvider } from "@/components/sync-status"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Fader", template: "%s · Fader" },
  description: "Your X following feed, with a fader per account.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark antialiased">
      <body>
        <TooltipProvider delay={300}>
          <SyncStatusProvider>
            {/* X's columns: navigation, the page (600px), and on wide screens a sidebar the page brings. */}
            <div className="flex min-h-dvh justify-center">
              <SideNav />
              {children}
            </div>
            <BottomNav />
          </SyncStatusProvider>
        </TooltipProvider>
        <Toaster position="bottom-center" mobileOffset={{ bottom: 72 }} />
      </body>
    </html>
  )
}
