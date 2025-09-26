"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { IconAdjustments, IconBell, IconPlus } from "@tabler/icons-react"

import { ModeToggle } from "@/components/mode-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const routeMeta: Record<
  string,
  { title: string; description: string; badge?: string }
> = {
  "/block-stats": {
    title: "Block Stats & Analytics",
    description: "Measure the health of your active trading block at a glance.",
    badge: "Live",
  },
  "/performance-blocks": {
    title: "Performance Blocks",
    description: "Equity curves, streaks, and drawdown coverage across time.",
  },
  "/risk-simulator": {
    title: "Risk Simulator",
    description: "Monte Carlo projections using your uploaded trade history.",
  },
  "/position-sizing": {
    title: "Position Sizing",
    description: "Dial in optimal size with Kelly, volatility caps, and constraints.",
  },
  "/correlation-matrix": {
    title: "Correlation Matrix",
    description: "Understand strategy overlap before deploying capital.",
  },
  "/capital-blocks": {
    title: "Capital Blocks",
    description: "Budget capital to blocks and track how it flexes over time.",
    badge: "Soon",
  },
  "/time-machine": {
    title: "Time Machine",
    description: "Replay your block history as if it were happening today.",
    badge: "Soon",
  },
  "/trade-blocks": {
    title: "Trade Blocks",
    description: "Audit every block in one sortable timeline.",
  },
  "/uploads": {
    title: "Upload Center",
    description: "Manage trade logs, daily logs, and active block pairs.",
  },
  "/settings": {
    title: "Settings",
    description: "Configure account defaults, risk tolerances, and integrations.",
  },
  "/support": {
    title: "Help & Docs",
    description: "Guides, release notes, and common workflows.",
  },
}

export function SiteHeader() {
  const pathname = usePathname()

  const meta = useMemo(() => {
    if (!pathname) return routeMeta["/block-stats"]
    const base = `/${pathname.split("/")[1] ?? ""}` || "/block-stats"
    return routeMeta[base] ?? routeMeta["/block-stats"]
  }, [pathname])

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background/70 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <div className="flex w-full items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold leading-tight md:text-lg">
              {meta.title}
            </h1>
            {meta.badge && (
              <Badge variant="secondary" className="text-[0.65rem] uppercase">
                {meta.badge}
              </Badge>
            )}
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            {meta.description}
          </p>
        </div>
        <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-muted-foreground md:flex">
          <Input
            placeholder="Search metrics, symbols, or blocks"
            className="border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <IconAdjustments className="size-4" />
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            <IconPlus className="size-4" />
            New Upload
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <IconBell className="size-5" />
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
