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
  IconTimelineEvent,
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
      title: "TP Optimizer (MAE/MFE)",
      href: "/tp-optimizer-mae-mfe",
      icon: IconTarget,
      badge: "Latest",
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
      title: "Walk-Forward",
      href: "/walk-forward",
      icon: IconTimelineEvent,
      badge: "Beta",
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
              className="data-[slot=sidebar-menu-button]:!p-2"
            >
              <Link href="/block-stats" className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2">
                  <div className="h-9 w-9 flex-shrink-0 rounded-md bg-card/10 p-1">
                    <div className="relative h-full w-full">
                      <Image
                        src="/nemoblocks-logo.png"
                        alt="NemoBlocks logo"
                        fill
                        className="object-contain"
                        priority
                      />
                    </div>
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-base font-semibold text-foreground">
                      NemoBlocks
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Analytics Platform
                    </span>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="relative">
        <NavMain items={navData.navMain} />
        {/* Scroll indicator - subtle gradient fade at bottom */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-sidebar to-transparent" />
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
