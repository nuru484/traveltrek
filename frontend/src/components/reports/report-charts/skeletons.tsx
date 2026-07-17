// src/components/reports/report-charts/skeletons.tsx
//
// Loading skeletons that mirror each loaded card's anatomy node-for-node:
// chart card, KPI card (and the KPI row), and the ranked/list card.
"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Varied bar heights so the chart skeleton reads as a chart, not a blob.
const SKELETON_BAR_HEIGHTS = [28, 55, 40, 70, 33, 60];

/**
 * Chart-card skeleton mirroring the loaded card's anatomy: header row, then
 * a plot area sketched as varied bars over an x-axis label row.
 */
export function ChartCardSkeleton({
  title,
  height = 240,
}: {
  title?: string;
  height?: number;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        {title ? (
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        ) : (
          <Skeleton className="h-4 w-28" />
        )}
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex w-full flex-col" style={{ height }}>
        <div className="flex flex-1 items-end gap-2 pb-2 sm:gap-4">
          {SKELETON_BAR_HEIGHTS.map((h, i) => (
            <Skeleton
              key={i}
              className="w-full rounded-sm"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between gap-2">
          {SKELETON_BAR_HEIGHTS.map((_, i) => (
            <Skeleton key={i} className="h-3 w-10" />
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * A single KPI-card skeleton mirroring KpiCard node-for-node: mono label row
 * with dotted leader + code tag, display figure, dashed tear line + trend
 * row. Safe to drop straight into a grid cell.
 */
export function KpiCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="px-5 py-5">
        {/* Label row: mono label · dotted leader · code tag */}
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-3 w-24" />
          <span
            aria-hidden
            className="min-w-3 flex-1 translate-y-[-2px] border-b border-dotted border-foreground/25"
          />
          <Skeleton className="h-3 w-8" />
        </div>
        {/* Display figure */}
        <Skeleton className="mt-4 h-8 w-28" />
        {/* Dashed tear line + trend row */}
        <div className="mt-4 border-t border-dashed border-foreground/20 pt-3">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-3.5" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    </Card>
  );
}

/** KPI-row skeleton: `count` KpiCardSkeletons in the KPI grid. */
export function KpiCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2",
        count >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** List-card skeleton with bordered rows matching the real row padding. */
export function ListCardSkeleton({
  title,
  rows = 5,
}: {
  title?: string;
  rows?: number;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        {title ? (
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        ) : (
          <Skeleton className="h-4 w-32" />
        )}
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
