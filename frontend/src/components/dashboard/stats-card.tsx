// src/components/dashboard/stats-card.tsx
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IStatsCardProps {
  title: string;
  value: number;
  subtitle?: string;
  /** Short mono tag shown opposite the label, e.g. "TRS", "FLT". */
  code?: string;
  details?: Array<{
    label: string;
    value: number;
    color?: "default" | "secondary" | "destructive" | "outline";
  }>;
}

/**
 * Stat tile as a boarding-pass field: mono label row with a dotted leader to
 * a code tag, a serif display figure, and mono status chips below a dashed
 * tear line.
 */
export function StatsCard({
  title,
  value,
  subtitle,
  code,
  details,
}: IStatsCardProps) {
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
          <span className="font-display text-5xl font-semibold leading-none tracking-tight text-foreground">
            {value.toLocaleString()}
          </span>
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>

        {details && details.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5 border-t border-dashed border-foreground/20 pt-4">
            {details.map((detail, index) => (
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
