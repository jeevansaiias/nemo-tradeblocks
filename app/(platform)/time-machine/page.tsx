import { PagePlaceholder } from "@/components/page-placeholder"

export default function TimeMachinePage() {
  return (
    <PagePlaceholder
      title="Time Machine"
      description="Re-simulate your block history day by day to capture decisions, context, and missed opportunities."
      badge="Coming soon"
      items={[
        {
          title: "Replay Mode",
          description: "Step through trades chronologically with annotations and context snapshots.",
        },
        {
          title: "Decision Log",
          description: "Capture why trades were taken and review them alongside actual outcomes.",
        },
        {
          title: "Alt Scenarios",
          description: "Branch into what-if scenarios and compare to the original block stats.",
        },
      ]}
    />
  )
}
