// src/components/reports/report-charts/ranked-bar-list.tsx
//
// The ranked leaderboard: rank number, name (link), amount, and a bar
// proportional to the top entry. Money values are integer pesewas.
"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/utils/format-money";
import { ChartCardHeader } from "./primitives";
import { CardEmpty } from "./card-states";

export interface RankedItem {
  key: React.Key;
  name: string;
  href?: string;
  /** Integer pesewas. */
  amount: number;
  /** Right-aligned count caption, e.g. "12 bookings". */
  caption: string;
}

/**
 * Ranked leaderboard: rank number, name (link), amount, and a bar
 * proportional to the top entry. One hue — magnitude is carried by length.
 */
export const RankedBarList = ({
  title,
  items,
  meta,
  emptyTitle = "No data in this period",
}: {
  title: string;
  items: RankedItem[];
  meta?: React.ReactNode;
  emptyTitle?: string;
}) => {
  // Ranking is by booking count, so the largest amount isn't necessarily
  // rank 1 — scale bars against the true maximum.
  const max = items.reduce((best, item) => Math.max(best, item.amount), 0);

  return (
    <Card className="gap-0 p-5">
      <ChartCardHeader title={title} meta={meta} />
      {items.length === 0 ? (
        <CardEmpty title={emptyTitle} />
      ) : (
        <ol className="space-y-2.5">
          {items.map((item, i) => (
            <li key={item.key} className="flex items-center gap-2 text-xs">
              <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="truncate text-primary underline-offset-4 hover:underline"
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <span className="truncate text-foreground">{item.name}</span>
                  )}
                  <span className="shrink-0 font-medium text-foreground">
                    {formatMoney(item.amount)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${max > 0 ? (item.amount / max) * 100 : 0}%`,
                      backgroundColor: "var(--chart-1)",
                    }}
                  />
                </div>
              </div>
              <span className="w-20 shrink-0 text-right text-muted-foreground">
                {item.caption}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
};
