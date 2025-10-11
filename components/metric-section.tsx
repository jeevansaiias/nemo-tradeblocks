"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MetricSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: string | React.ReactNode;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  children: React.ReactNode;
  className?: string;
  gridCols?: 2 | 3 | 4 | 5;
}

export function MetricSection({
  title,
  icon,
  badge,
  badgeVariant = "secondary",
  children,
  className,
  gridCols = 3,
}: MetricSectionProps) {
  const gridClasses = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Section Header */}
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          {badge && (
            typeof badge === "string" ? (
              <Badge variant={badgeVariant} className="text-xs px-2 py-0.5">
                {badge}
              </Badge>
            ) : (
              badge
            )
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className={cn(
        "grid gap-4",
        gridClasses[gridCols]
      )}>
        {children}
      </div>
    </div>
  );
}