// src/components/reports/report-charts/card-states.tsx
//
// Per-card empty and error states: a chart card keeps its failure/empty
// contained to its own surface rather than blanking the whole dashboard.
"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";

/** Per-card empty state — typographic, matching the app's EmptyState voice. */
export function CardEmpty({
  title = "No data in this period",
  description = "Try adjusting the filters or the date range.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-52 items-center justify-center py-4">
      <EmptyState eyebrow="Nothing recorded" title={title} description={description} />
    </div>
  );
}

/** Per-card error — an error stays contained to its own card. */
export function CardError({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="gap-0 p-5">
      {title && (
        <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      )}
      <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Unexpected turbulence
        </p>
        <p className="text-sm text-muted-foreground">
          {message ?? "Couldn't load this data."}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <RefreshCw className="h-3 w-3 shrink-0" aria-hidden />
            Retry
          </button>
        )}
      </div>
    </Card>
  );
}
