// src/components/reports/report-charts/primitives.tsx
//
// Dependency-free building blocks shared by every report/dashboard chart card:
// the status/method label map, the compact-money axis formatter, the fixed
// categorical palette, the trend indicator, the KPI-value tooltip, and the
// chart-card header row. Every money value entering these is integer pesewas.
"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatMoney } from "@/utils/format-money";
import { ITrend } from "@/types/reports.types";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  // Booking statuses
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  // Payment statuses
  FAILED: "Failed",
  REFUNDED: "Refunded",
  REFUND_REQUESTED: "Refund requested",
  // Payment methods
  CREDIT_CARD: "Credit card",
  DEBIT_CARD: "Debit card",
  MOBILE_MONEY: "Mobile money",
  BANK_TRANSFER: "Bank transfer",
  // Tour types / statuses
  ADVENTURE: "Adventure",
  CULTURAL: "Cultural",
  BEACH: "Beach",
  CITY: "City",
  WILDLIFE: "Wildlife",
  CRUISE: "Cruise",
  UPCOMING: "Upcoming",
  ONGOING: "Ongoing",
  // Booked-item types (my-report byType breakdown)
  TOUR: "Tours",
  ROOM: "Hotel rooms",
  FLIGHT: "Flights",
};
export const label = (key: string) => LABELS[key] ?? key;

/**
 * Short money label for chart axes/data labels, e.g. "GH₵ 1.2k".
 * Input is integer pesewas.
 */
export const compactMoney = (pesewas: number): string => {
  const cedis = pesewas / 100;
  const abs = Math.abs(cedis);
  const short =
    abs >= 1_000_000
      ? `${(cedis / 1_000_000).toFixed(1)}M`
      : abs >= 1_000
        ? `${(cedis / 1_000).toFixed(1)}k`
        : `${Math.round(cedis)}`;
  return `GH₵ ${short}`;
};

/**
 * Categorical palette: the app's chart tokens in a FIXED assignment order
 * validated with the dataviz palette checker in both themes (adjacent-pair
 * CVD separation + contrast vs the card surface). Never cycle or reorder.
 */
export const PALETTE = [
  "var(--chart-1)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-5)",
  "var(--chart-3)",
];

export const TrendIndicator = ({
  direction,
  percentage,
}: ITrend) => {
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const color =
    direction === "up"
      ? "text-green-600 dark:text-green-400"
      : direction === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        color,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {Math.abs(percentage)}% vs previous
    </span>
  );
};

/**
 * What a segment's `amount` means: integer pesewas ("money") or a plain
 * count ("count" — e.g. the bookings status breakdown, which has no
 * amounts on the wire).
 */
export type SegmentValueKind = "money" | "count";

export const formatCompactValue = (
  kind: SegmentValueKind,
  value: number,
): string => (kind === "money" ? compactMoney(value) : value.toLocaleString());

interface TooltipEntry {
  key?: string;
  period?: string;
  amount?: number;
  count?: number;
  percentage?: number;
  previousAmount?: number;
}

interface CurrencyTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: TooltipEntry }>;
  unit?: string;
  valueKind?: SegmentValueKind;
}

/** Recharts tooltip rendering pesewas through formatMoney. */
export const CurrencyTooltip: React.FC<CurrencyTooltipProps> = ({
  active,
  payload,
  unit = "booking",
  valueKind = "money",
}) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload ?? {};
  const title = p.period ?? (p.key ? label(p.key) : "");
  const showCount = valueKind === "money" && typeof p.count === "number";
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs">
      {title && <div className="mb-0.5 font-medium text-foreground">{title}</div>}
      <div className="font-semibold text-foreground">
        {valueKind === "count"
          ? `${(p.amount ?? 0).toLocaleString()} ${unit}${(p.amount ?? 0) === 1 ? "" : "s"}`
          : formatMoney(p.amount ?? 0)}
      </div>
      {showCount && (
        <div className="text-muted-foreground">
          {p.count} {unit}
          {p.count === 1 ? "" : "s"}
        </div>
      )}
      {typeof p.percentage === "number" && p.percentage > 0 && (
        <div className="text-muted-foreground">{p.percentage}% of total</div>
      )}
      {typeof p.previousAmount === "number" && (
        <div className="mt-0.5 text-muted-foreground">
          prev: {formatMoney(p.previousAmount)}
        </div>
      )}
    </div>
  );
};

export const ChartCardHeader = ({
  title,
  meta,
}: {
  title: string;
  meta?: React.ReactNode;
}) => (
  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
  </div>
);
