// src/components/dashboard/skeletons.tsx
//
// Per-widget loading placeholders that mirror each widget's REAL DOM
// node-for-node (the dms Skeletons pattern): same card paddings, the
// boarding-pass label row with its dotted leader and code tag, the dashed
// tear line, bordered list rows, varied chart bar heights. Composed inside
// the same page grids as the loaded widgets, so nothing shifts when data
// lands. Chart/list/KPI skeletons for the report cards live in
// components/reports/report-charts.tsx and are reused here.
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors StatsCard: label row (mono label · dotted leader · code tag),
 * display figure + subtitle, then the dashed tear line with badge pills.
 */
export function StatsCardSkeleton({ pills = 2 }: { pills?: number }) {
  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <CardContent className="px-5 py-5">
        {/* Label row: mono label · dotted leader · code tag */}
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-3 w-16" />
          <span
            aria-hidden
            className="min-w-3 flex-1 translate-y-[-2px] border-b border-dotted border-foreground/25"
          />
          <Skeleton className="h-3 w-8" />
        </div>

        {/* Display figure + subtitle */}
        <div className="mt-4 flex items-baseline gap-2">
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Dashed tear line + badge pills */}
        {pills > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-dashed border-foreground/20 pt-4">
            {Array.from({ length: pills }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-20 rounded-full" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Row A: the four platform stat cards, in the loaded row's grid. */
export function PlatformStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[2, 1, 1, 0].map((pills, i) => (
        <StatsCardSkeleton key={i} pills={pills} />
      ))}
    </div>
  );
}

/** Row B: the four business stat cards, in the loaded row's grid. */
export function BusinessStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[3, 2, 1, 1].map((pills, i) => (
        <StatsCardSkeleton key={i} pills={pills} />
      ))}
    </div>
  );
}

/**
 * Mirrors the NeedsAttention strip: header (title + caption, status line),
 * then five bordered tiles each with icon circle · count, label, description.
 */
export function NeedsAttentionSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex flex-col gap-2 p-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Attention tiles */}
      <div className="grid grid-cols-1 gap-4 p-5 pt-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-7 w-8" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Quick-actions row: four outline buttons with label + arrow tag. */
export function QuickActionsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-border px-4 py-3.5"
        >
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-4" />
        </div>
      ))}
    </div>
  );
}
