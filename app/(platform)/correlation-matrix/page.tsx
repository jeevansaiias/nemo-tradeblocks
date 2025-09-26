import { PagePlaceholder } from "@/components/page-placeholder"

export default function CorrelationMatrixPage() {
  return (
    <PagePlaceholder
      title="Correlation Matrix"
      description="Quantify dependency between strategies, instruments, and time frames before you stack blocks together."
      items={[
        {
          title: "Heatmap",
          description: "Interactive matrix with clustering and dynamic filtering by tag or strategy class.",
        },
        {
          title: "Overlap Alerts",
          description: "Highlight correlations above custom thresholds to guard against overcrowding.",
        },
        {
          title: "Export",
          description: "Export correlation data to CSV or shareable Workspaces with annotations.",
        },
      ]}
    />
  )
}
