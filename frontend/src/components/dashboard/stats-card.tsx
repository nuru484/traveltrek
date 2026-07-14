// src/components/dashboard/stats-card.tsx
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IStatsCardProps {
  title: string;
  value: number;
  subtitle?: string;
  details?: Array<{
    label: string;
    value: number;
    color?: "default" | "secondary" | "destructive" | "outline";
  }>;
}

/**
 * Stat tile in the landing's document voice: a mono field label, the figure,
 * and mono status chips — no icon chips, no per-card accent colors.
 */
export function StatsCard({ title, value, subtitle, details }: IStatsCardProps) {
  return (
    <Card className="gap-0 py-5">
      <CardContent className="px-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          {value.toLocaleString()}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}

        {details && details.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-dashed border-foreground/15 pt-3.5">
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
