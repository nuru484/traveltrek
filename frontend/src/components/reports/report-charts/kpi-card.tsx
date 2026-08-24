// src/components/reports/report-charts/kpi-card.tsx
//
// The KPI stat card in the boarding-pass voice.
"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";

/**
 * KPI stat card in the boarding-pass voice: mono label row with a dotted
 * leader to a code tag, serif display figure, and a sub row (usually a
 * TrendIndicator) under a dashed tear line.
 */
export const KpiCard = ({
  title,
  code,
  value,
  sub,
}: {
  title: string;
  /** Short mono tag opposite the label, e.g. "BKG". */
  code?: string;
  value: string;
  sub?: React.ReactNode;
}) => (
  <Card className="gap-0 overflow-hidden py-0">
    <div className="px-5 py-5">
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
      <p className="mt-4 font-display text-2xl font-semibold leading-none sm:text-3xl tracking-tight text-foreground">
        {value}
      </p>
      {sub && (
        <div className="mt-4 border-t border-dashed border-foreground/20 pt-3 text-xs text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  </Card>
);
