import { IconArrowUpRight, IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const cards = [
  {
    label: "Number of Trades",
    value: "749",
    change: "+28 trades",
    trend: "up",
    context: "Across the selected trade period",
  },
  {
    label: "Starting Capital",
    value: "$500,000",
    change: "",
    trend: "flat",
    context: "Portfolio value on Jan 02, 2025",
  },
  {
    label: "Avg Return on Margin",
    value: "14.23%",
    change: "+2.14 pts",
    trend: "up",
    context: "Net of fees at position level",
  },
  {
    label: "Std Dev of RoM",
    value: "61.40%",
    change: "-5.9 pts",
    trend: "down",
    context: "Volatility of per-trade returns",
  },
]

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription className="text-sm text-muted-foreground">
              {card.label}
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value}
            </CardTitle>
            {card.change && (
              <CardAction>
                <Badge
                  variant="outline"
                  className="gap-1 text-xs font-medium uppercase tracking-wide"
                >
                  {card.trend === "up" ? (
                    <IconTrendingUp className="size-3.5" />
                  ) : card.trend === "down" ? (
                    <IconTrendingDown className="size-3.5" />
                  ) : (
                    <IconArrowUpRight className="size-3.5" />
                  )}
                  {card.change}
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-foreground">
              {card.trend === "down" ? (
                <>
                  Slight contraction
                  <IconTrendingDown className="size-4 text-amber-500" />
                </>
              ) : card.trend === "up" ? (
                <>
                  Momentum building
                  <IconTrendingUp className="size-4 text-emerald-500" />
                </>
              ) : (
                <>
                  Stable metric
                  <IconArrowUpRight className="size-4 text-muted-foreground" />
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{card.context}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
