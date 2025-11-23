"use client";

import {
  IconChartHistogram,
  IconGauge,
  IconLayoutDashboard,
  IconLink,
  IconReportAnalytics,
  IconRouteSquare,
  IconStack2,
} from "@tabler/icons-react";
// logo replaced by /public/logo-nemo.png image
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
      icon: IconReportAnalytics,
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
      icon: IconLink,
      badge: "Beta",
    },
    {
      title: "P/L Calendar",
      href: "/calendar",
      icon: IconChartHistogram,
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
              className="data-[slot=sidebar-menu-button]:!p-2"
            >
                <Link href="/block-stats" className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2">
                  <div className="relative h-8 w-8 flex-shrink-0 rounded-md bg-transparent">
                    <Image
                      src="/logo-nemo.png"
                      alt="NemoBlocks logo"
                      fill
                      className="object-contain"
                      priority={true}
                    />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-base font-semibold text-foreground">NemoBlocks</span>
                    <span className="text-xs text-muted-foreground">Analytics Platform</span>
                  </div>
                </div>
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
