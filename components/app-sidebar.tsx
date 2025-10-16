"use client";

import {
  IconCalendarStats,
  IconChartHistogram,
  IconGauge,
  IconGitCompare,
  IconLayoutDashboard,
  IconReportAnalytics,
  IconRouteSquare,
  IconStack2,
  IconTarget,
  IconUser,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { useBlockStore } from "@/lib/stores/block-store";

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
      title: "Auto Take-Profit Optimizer",
      href: "/tp-optimizer",
      icon: IconTarget,
      badge: "New",
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
      title: "Comparison Blocks",
      href: "/comparison-blocks",
      icon: IconGitCompare,
      badge: "Beta",
    },
    {
      title: "P/L Calendar",
      href: "/calendar",
      icon: IconCalendarStats,
    },
    {
      title: "Personal Dashboard",
      href: "/personal-dashboard",
      icon: IconUser,
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
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const blocks = useBlockStore((state) => state.blocks);
  const activeBlockId = useBlockStore((state) => state.activeBlockId);
  const isInitialized = useBlockStore((state) => state.isInitialized);
  const loadBlocks = useBlockStore((state) => state.loadBlocks);
  const activeBlock =
    blocks.find((block) => block.id === activeBlockId) || null;
  const hasActiveBlock = activeBlock !== null;

  // Load blocks from IndexedDB on mount
  React.useEffect(() => {
    if (!isInitialized) {
      loadBlocks().catch(console.error);
    }
  }, [isInitialized, loadBlocks]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-3"
            >
              <Link href="/block-stats" className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Image
                    src="/nemoblocks-logo.png"
                    alt="NemoBlocks Logo"
                    width={48}
                    height={48}
                    className="rounded-lg"
                  />
                </div>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight">
                    NemoBlocks
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
      </SidebarContent>
      {hasActiveBlock && activeBlock && (
        <SidebarActiveBlocks activeBlock={activeBlock} />
      )}
      <SidebarFooter>
        <SidebarFooterLegal />
      </SidebarFooter>
    </Sidebar>
  );
}