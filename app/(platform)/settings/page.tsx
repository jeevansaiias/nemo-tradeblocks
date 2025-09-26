import { PagePlaceholder } from "@/components/page-placeholder"

export default function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      description="Configure account details, default risk preferences, integrations, and workspace members."
      items={[
        {
          title: "Workspace",
          description: "Manage members, roles, and notification defaults for collaborators.",
        },
        {
          title: "Integrations",
          description: "Connect broker APIs, cloud storage, or custom webhooks.",
        },
        {
          title: "Preferences",
          description: "Set default risk-free rate, benchmark symbols, and date formats.",
        },
      ]}
    />
  )
}
