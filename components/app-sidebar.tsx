"use client";

import {
  IconChartHistogram,
  IconGauge,
  IconLayoutDashboard,
  IconReportAnalytics,
  IconRouteSquare,
  IconSettings,
  IconStack2,
} from "@tabler/icons-react";
import { Blocks } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { NavMain } from "@/components/nav-main";
import { SidebarActiveBlocks } from "@/components/sidebar-active-blocks";
import { SidebarFooterLegal } from "@/components/sidebar-footer-legal";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navData = {
  navMain: [
    {
      title: "Block Management",
      href: "/blocks",
      icon: IconStack2,
    },
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
      title: "Position Sizing",
      href: "/position-sizing",
      icon: IconGauge,
    },
    {
      title: "Risk Simulator",
      href: "/risk-simulator",
      icon: IconRouteSquare,
    },
    {
      title: "Correlation Matrix",
      href: "/correlation-matrix",
      icon: IconChartHistogram,
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
};

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
              <Link href="/block-stats" className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Blocks className="h-8 w-8 text-primary" />
                </div>
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
      </SidebarContent>
      <SidebarFooter>
        <SidebarFooterLegal />
      </SidebarFooter>
    </Sidebar>
  );
}
