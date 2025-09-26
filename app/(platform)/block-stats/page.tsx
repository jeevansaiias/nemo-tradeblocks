import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { BlockMetricsTable } from "@/components/block-metrics-table"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SectionCards } from "@/components/section-cards"

export default function BlockStatsPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 lg:px-6">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Block Snapshot</h2>
            <p className="text-sm text-muted-foreground">
              Active Pair · Trade Log & Daily Log synced on Sep 18, 2025
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select defaultValue="0.02">
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Risk-free" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="0.02">Risk-free: 2%</SelectItem>
                <SelectItem value="0.03">Risk-free: 3%</SelectItem>
                <SelectItem value="0.05">Risk-free: 5%</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All strategies" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All strategies</SelectItem>
                <SelectItem value="core">Core Trend</SelectItem>
                <SelectItem value="swing">Swing Companion</SelectItem>
                <SelectItem value="mean">Mean Reversion</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              Export Report
            </Button>
          </div>
        </div>
        <SectionCards />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 lg:px-6">
          <div>
            <h3 className="text-base font-semibold sm:text-lg">Equity Curve</h3>
            <p className="text-sm text-muted-foreground">
              Portfolio equity with drawdown overlays and high-water markers.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Data range: Jan 02, 2025 → Sep 18, 2025
          </div>
        </div>
        <ChartAreaInteractive />
      </section>

      <BlockMetricsTable />
    </div>
  )
}
