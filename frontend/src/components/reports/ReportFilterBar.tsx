// src/components/reports/ReportFilterBar.tsx
//
// The reports filter bar. Two renderings, decided by how many controls a tab
// has (isInlineFilterBar threshold):
//
// - At or under the threshold (period-only tabs): the controls render INLINE
//   in the toolbar - no Filters button, no collapsed panel (period-only tabs
//   shouldn't hide their one select behind a click).
// - Above it: a Filters button with an active-count badge that
//   rolls out an inline panel below the toolbar on every screen size - the
//   same drop-down behaviour as the list-page filter bars.
"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isInlineFilterBar } from "./report-filters-logic";

interface ReportFilterBarProps {
  /** The filter controls, rendered inline or in the drop-down panel. */
  filterFields: React.ReactNode;
  /**
   * How many filter controls `filterFields` contains (period included).
   * At or under the inline threshold the controls render directly in the
   * toolbar; above it they collapse behind the Filters button.
   */
  controlCount?: number;
  /** Columns in the lg+ panel grid (one per single-cell control). */
  filterColumns?: 2 | 3 | 4;
  filterCount: number;
  hasFiltersApplied: boolean;
  onClearAll: () => void;
  /** Right-aligned actions (e.g. print), always visible. */
  actions?: React.ReactNode;
}

// Static class map so Tailwind keeps these grid utilities.
const LG_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export function ReportFilterBar({
  filterFields,
  controlCount = 4,
  filterColumns = 4,
  filterCount,
  hasFiltersApplied,
  onClearAll,
  actions,
}: ReportFilterBarProps) {
  const [showFilters, setShowFilters] = React.useState(false);

  // Few controls: render them straight into the toolbar, no button/panel.
  // lg+ caps each control at a quarter of the row (4-col grid) so one or
  // two selects don't stretch to half the page.
  if (isInlineFilterBar(controlCount)) {
    return (
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 basis-64 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filterFields}
        </div>
        <div className="flex flex-none items-center gap-2">
          {hasFiltersApplied && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="cursor-pointer text-destructive hover:bg-destructive/10"
            >
              Clear
            </Button>
          )}
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters button sits in front of the always-visible actions. */}
      <div className="flex items-center gap-2">
        <Button
          variant={hasFiltersApplied ? "default" : "outline"}
          onClick={() => setShowFilters((open) => !open)}
          className="h-10 shrink-0 cursor-pointer gap-2"
        >
          <SlidersHorizontal strokeWidth={1.5} className="h-4 w-4" />
          <span className="text-sm">Filters</span>
          {filterCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 min-w-5 rounded-full px-1 text-xs"
            >
              {filterCount}
            </Badge>
          )}
        </Button>
        {actions}
      </div>

      {/* Drop-down panel, every screen size. */}
      {showFilters && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <div
            className={cn(
              "grid grid-cols-1 gap-3 sm:grid-cols-2",
              LG_COLS[filterColumns] ?? LG_COLS[4],
            )}
          >
            {filterFields}
          </div>
          {hasFiltersApplied && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="cursor-pointer text-destructive hover:bg-destructive/10"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
