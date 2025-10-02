import { PagePlaceholder } from "@/components/page-placeholder"

export default function UploadsPage() {
  return (
    <PagePlaceholder
      title="Upload Center"
      description="Import multiple trade logs and daily logs, validate column mappings, and activate a block pairing in one flow."
      items={[
        {
          title: "File Intake",
          description: "Drag-and-drop uploader with validation for CSV, XLSX, and API imports.",
        },
        {
          title: "Mapping",
          description: "Map your custom headers to TradeBlocks fields and save presets per brokerage.",
        },
        {
          title: "Activation",
          description: "Choose the active trade + daily log pair and set defaults for analytics.",
        },
      ]}
      actionLabel="Start upload"
    />
  )
}
