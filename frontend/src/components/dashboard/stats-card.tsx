// src/components/dashboard/stats-card.tsx
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendIndicator } from "@/components/reports/report-charts";
import { ITrend } from "@/types/reports.types";
import { cn } from "@/lib/utils";

interface IStatsCardProps {
  title: string;
  /** Preformatted strings (e.g. money) render as-is. */
  value: number | string;
  subtitle?: string;
  /** Short mono tag shown opposite the label, e.g. "TRS", "FLT". */
  code?: string;
  /** Change vs the previous period, shown under the dashed tear line. */
  trend?: ITrend;
  details?: Array<{
    label: string;
    value: number | string;
    color?: "default" | "secondary" | "destructive" | "outline";
  }>;
}

/**
 * Stat tile as a boarding-pass field: mono label row with a dotted leader to
 * a code tag, a serif display figure, and mono status chips / a trend
 * indicator below a dashed tear line.
 */
export function StatsCard({
  title,
  value,
  subtitle,
  code,
  trend,
  details,
}: IStatsCardProps) {
  const hasFooter = trend !== undefined || (details && details.length > 0);
  // Length-adaptive figure scale: long preformatted figures (money) step
  // down so they never wrap mid-figure or overflow the card.
  const length = String(value).length;
  const figureClass =
    length > 12 ? "text-2xl" : length > 9 ? "text-3xl" : "text-5xl";

  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <CardContent className="px-5 py-5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </span>
          <span
            aria-hidden
            className="min-w-3 flex-1 translate-y-[-2px] border-b border-dotted border-foreground/25"
          />
          {code && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              {code}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span
            className={cn(
              "font-display font-semibold leading-none tracking-tight text-foreground",
              // The stepped-down sizes fit any figure the formatter can emit
              // (formatMoney compacts at 1M), so keep the figure unbroken.
              "whitespace-nowrap",
              figureClass,
            )}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>

        {hasFooter && (
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-dashed border-foreground/20 pt-4">
            {trend && <TrendIndicator {...trend} />}
            {details?.map((detail, index) => (
              <Badge key={index} variant={detail.color || "outline"}>
                {detail.label}: {detail.value}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
