import { PagePlaceholder } from "@/components/page-placeholder"

export default function PositionSizingPage() {
  return (
    <PagePlaceholder
      title="Position Sizing"
      description="Design optimal sizing frameworks using Kelly fractions, volatility caps, and block-level constraints."
      items={[
        {
          title: "Kelly Calculator",
          description: "Derive fractional Kelly position sizes based on historical block outcomes.",
        },
        {
          title: "Risk Budget",
          description: "Allocate risk units per strategy and enforce caps per time bucket.",
        },
        {
          title: "Scenario Overrides",
          description: "Model discretionary overrides and compare their impact to baseline sizing.",
        },
      ]}
    />
  )
}
