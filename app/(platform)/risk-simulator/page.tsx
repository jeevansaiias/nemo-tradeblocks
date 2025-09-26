import { PagePlaceholder } from "@/components/page-placeholder"

export default function RiskSimulatorPage() {
  return (
    <PagePlaceholder
      title="Risk Simulator"
      description="Monte Carlo tools to project block-level outcomes using your actual trade distributions. Configure simulation length, capital regimes, and percentile bands for scenario testing."
      items={[
        {
          title: "Simulation Parameters",
          description: "Control trade count, capital, and strategy mix per simulation batch.",
        },
        {
          title: "Percentile Bands",
          description: "Overlay median, 25/75, and tail percentiles with custom colors and labels.",
        },
        {
          title: "Scenario Library",
          description: "Save presets for aggressive, base, and defensive risk profiles.",
        },
      ]}
    />
  )
}
