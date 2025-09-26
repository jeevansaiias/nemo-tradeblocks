"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  IconBarbell,
  IconChartHistogram,
  IconGauge,
  IconHelpSquareRounded,
  IconLayoutDashboard,
  IconLayoutSidebarRightExpand,
  IconReportAnalytics,
  IconRouteSquare,
  IconSettings,
  IconSparkles,
  IconStack2,
} from "@tabler/icons-react"

import { SidebarActiveBlocks } from "@/components/sidebar-active-blocks"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navData = {
  user: {
    name: "TradeBlocks Studio",
    email: "hi@tradeblocks.dev",
    avatar: "/tradeblocks-logo.png",
  },
  navMain: [
    {
      title: "Block Stats",
      href: "/block-stats",
      icon: IconLayoutDashboard,
    },
    {
      title: "Performance Blocks",
      href: "/performance-blocks",
      icon: IconReportAnalytics,
    },
    {
      title: "Risk Simulator",
      href: "/risk-simulator",
      icon: IconRouteSquare,
    },
    {
      title: "Position Sizing",
      href: "/position-sizing",
      icon: IconGauge,
    },
    {
      title: "Correlation Matrix",
      href: "/correlation-matrix",
      icon: IconChartHistogram,
    },
    {
      title: "Capital Blocks",
      href: "/capital-blocks",
      icon: IconBarbell,
      soon: true,
    },
    {
      title: "Time Machine",
      href: "/time-machine",
      icon: IconSparkles,
      soon: true,
    },
    {
      title: "Trade Blocks",
      href: "/trade-blocks",
      icon: IconStack2,
    },
  ],
  navSecondary: [
    {
      title: "Upload Center",
      href: "/uploads",
      icon: IconLayoutSidebarRightExpand,
    },
    {
      title: "Help & Docs",
      href: "/support",
      icon: IconHelpSquareRounded,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: IconSettings,
    },
  ],
  activeSets: [
    {
      id: "2025-demo",
      title: "2025 Over 100k Trials",
      isActive: true,
      lastUpdated: "Sep 18, 2025",
      tradeLog: {
        name: "2025-Over-100k-With-Trial-Tests.csv",
        entries: 749,
        type: "Trade Log",
      },
      dailyLog: {
        name: "2025-Over-100k-With-Trial-Tests (1).csv",
        entries: 178,
        type: "Daily Log",
      },
    },
    {
      id: "2024-swing",
      title: "2024 Swing Book",
      lastUpdated: "Aug 02, 2025",
      tradeLog: {
        name: "2024-Swing-Trades.csv",
        entries: 553,
        type: "Trade Log",
      },
      dailyLog: {
        name: "2024-Swing-Notes.csv",
        entries: 211,
        type: "Daily Log",
      },
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-2"
            >
              <Link href="/block-stats" className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background">
                  <Image
                    src="/tradeblocks-logo.png"
                    alt="TradeBlocks logo"
                    width={24}
                    height={24}
                    className="object-contain"
                    priority
                  />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight">
                    TradeBlocks
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Analytics Platform
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navData.navMain} />
        <SidebarActiveBlocks sets={navData.activeSets} />
        <div className="group-data-[collapsible=icon]:hidden">
          <Button asChild variant="outline" className="mt-3 w-full justify-center">
            <Link href="/uploads">Upload New Logs</Link>
          </Button>
        </div>
        <NavSecondary items={navData.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navData.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
