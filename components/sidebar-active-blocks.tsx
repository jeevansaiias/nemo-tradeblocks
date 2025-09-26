"use client"

import { IconArrowsShuffle, IconCheck, IconFileSpreadsheet, IconRefresh } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"

type BlockFile = {
  name: string
  entries: number
  type: "Trade Log" | "Daily Log"
}

type ActiveBlockSet = {
  id: string
  title: string
  isActive?: boolean
  lastUpdated: string
  tradeLog: BlockFile
  dailyLog: BlockFile
}

export function SidebarActiveBlocks({ sets }: { sets: ActiveBlockSet[] }) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Active Blocks</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-3">
        {sets.map((set) => (
          <div
            key={set.id}
            className="rounded-xl border border-border/60 bg-sidebar-accent/40 p-3 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <IconCheck
                  className={`size-4 rounded-full ${
                    set.isActive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                />
                <p className="text-sm font-semibold text-sidebar-foreground">
                  {set.title}
                </p>
              </div>
              <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wide">
                {set.isActive ? "Active" : "Ready"}
              </Badge>
            </div>
            <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-background/50 px-2 py-1">
                <dt className="flex items-center gap-2 font-medium text-foreground">
                  <IconFileSpreadsheet className="size-3.5" />
                  {set.tradeLog.type}
                </dt>
                <dd className="flex flex-col items-end text-right text-[0.7rem]">
                  <span className="max-w-[140px] truncate text-xs">
                    {set.tradeLog.name}
                  </span>
                  <span className="text-muted-foreground uppercase tracking-wide">
                    {set.tradeLog.entries} rows
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-background/50 px-2 py-1">
                <dt className="flex items-center gap-2 font-medium text-foreground">
                  <IconFileSpreadsheet className="size-3.5" />
                  {set.dailyLog.type}
                </dt>
                <dd className="flex flex-col items-end text-right text-[0.7rem]">
                  <span className="max-w-[140px] truncate text-xs">
                    {set.dailyLog.name}
                  </span>
                  <span className="text-muted-foreground uppercase tracking-wide">
                    {set.dailyLog.entries} rows
                  </span>
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between text-[0.65rem] text-muted-foreground">
              <span className="flex items-center gap-1">
                <IconRefresh className="size-3" />
                Updated {set.lastUpdated}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[0.7rem]"
              >
                <IconArrowsShuffle className="size-3" />
                Switch
              </Button>
            </div>
          </div>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
