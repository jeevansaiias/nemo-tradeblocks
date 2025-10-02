import { PagePlaceholder } from "@/components/page-placeholder"

export default function CapitalBlocksPage() {
  return (
    <PagePlaceholder
      title="Capital Blocks"
      description="Plan capital distribution across blocks, rollups, and brokers while monitoring drawdown limits."
      badge="Coming soon"
      items={[
        {
          title: "Capital Planner",
          description: "Drag-and-drop interface to assign capital and margin limits per block.",
        },
        {
          title: "Buffer Tracking",
          description: "Track remaining risk buffers and auto-alert when blocks approach limits.",
        },
        {
          title: "Broker Sync",
          description: "Optional integrations to sync allocations with brokerage APIs.",
        },
      ]}
    />
  )
}
