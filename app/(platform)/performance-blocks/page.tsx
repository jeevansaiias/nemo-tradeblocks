import { PagePlaceholder } from "@/components/page-placeholder"

export default function PerformanceBlocksPage() {
  return (
    <PagePlaceholder
      title="Performance Blocks"
      description="Equity curves, streak analytics, and context panels to compare blocks across different time horizons."
      items={[
        {
          title: "Equity Curve",
          description: "Layer multiple equity curves with drawdown shading and log-scale toggles.",
        },
        {
          title: "Streak Analyzer",
          description: "Understand the distribution of winning and losing streaks before reallocation.",
        },
        {
          title: "Monthly Heatmaps",
          description: "Visualize monthly and weekly return heatmaps to spot volatility clusters.",
        },
      ]}
    />
  )
}
