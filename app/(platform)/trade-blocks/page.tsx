import { PagePlaceholder } from "@/components/page-placeholder"

export default function TradeBlocksPage() {
  return (
    <PagePlaceholder
      title="Trade Blocks"
      description="Browse every block you have uploaded, filter by tag, and compare session-by-session performance."
      items={[
        {
          title: "Block Timeline",
          description: "Chronological view of block uploads with quick KPIs and status tags.",
        },
        {
          title: "Advanced Filters",
          description: "Filter by instrument, strategy tag, or performance ranges in seconds.",
        },
        {
          title: "Multi-compare",
          description: "Pin multiple blocks to compare KPIs and charts side by side.",
        },
      ]}
    />
  )
}
