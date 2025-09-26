import { PagePlaceholder } from "@/components/page-placeholder"

export default function SupportPage() {
  return (
    <PagePlaceholder
      title="Help & Docs"
      description="Guides, FAQs, and release notes to ensure you get the most out of TradeBlocks."
      items={[
        {
          title: "Guided Walkthroughs",
          description: "Step-by-step flows for onboarding, uploads, and analytics.",
        },
        {
          title: "Release Notes",
          description: "See what changed each sprint and what's coming next.",
        },
        {
          title: "Community",
          description: "Join our Slack-style workspace for trade reviews and feedback.",
        },
      ]}
    />
  )
}
