// src/components/reports/report-charts.tsx
//
// Shared visual primitives for the reports and dashboard widgets: palette,
// KPI card, trend indicator, currency tooltip, breakdown donut/bar, trend
// area chart, ranked-bar list, and the per-card skeleton/error/empty states.
// Every money value entering these components is integer pesewas.
"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  Label,
  ReferenceLine,
} from "recharts";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/utils/format-money";
import { IBreakdownSegment, ITrend } from "@/types/reports.types";
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
      <p className="mt-4 font-display text-3xl font-semibold leading-none tracking-tight text-foreground">
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

/**
 * What a segment's `amount` means: integer pesewas ("money") or a plain
 * count ("count" — e.g. the bookings status breakdown, which has no
 * amounts on the wire).
 */
export type SegmentValueKind = "money" | "count";

const formatCompactValue = (kind: SegmentValueKind, value: number): string =>
  kind === "money" ? compactMoney(value) : value.toLocaleString();

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

/**
 * Per-segment detail list — the readable/table view of each breakdown:
 * colour · label · count · amount · share. `data` must be the same ordered
 * array the chart renders so the colours line up.
 */
export const SegmentList = ({
  data,
  unit = "booking",
  valueKind = "money",
}: {
  data: IBreakdownSegment[];
  unit?: string;
  valueKind?: SegmentValueKind;
}) => (
  <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
    {data.map((s, i) => (
      <li key={s.key} className="flex items-center gap-2 text-xs">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: PALETTE[i % PALETTE.length] }}
        />
        <span className="flex-1 truncate text-foreground">{label(s.key)}</span>
        <span className="shrink-0 text-muted-foreground">
          {s.count} {unit}
          {s.count === 1 ? "" : "s"}
        </span>
        {valueKind === "money" && (
          <span className="w-24 shrink-0 text-right font-medium text-foreground">
            {formatMoney(s.amount)}
          </span>
        )}
        <span className="w-9 shrink-0 text-right text-muted-foreground">
          {s.percentage}%
        </span>
      </li>
    ))}
  </ul>
);

const ChartCardHeader = ({
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

export const BreakdownDonut = ({
  title,
  segments,
  unit = "booking",
  valueKind = "money",
}: {
  title: string;
  segments: IBreakdownSegment[];
  unit?: string;
  valueKind?: SegmentValueKind;
}) => {
  const data = segments
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = data.reduce((sum, s) => sum + s.amount, 0);
  const totalCount = data.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="gap-0 p-5">
      <ChartCardHeader
        title={title}
        meta={
          data.length > 0
            ? `${totalCount} ${unit}${totalCount === 1 ? "" : "s"}`
            : undefined
        }
      />
      {data.length === 0 ? (
        <CardEmpty />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="key"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
                // Enter animations restart on container resize and leave the
                // plot empty in prints/screenshots — draw immediately.
                isAnimationActive={false}
              >
                {data.map((entry, i) => (
                  <Cell key={entry.key} fill={PALETTE[i % PALETTE.length]} />
                ))}
                <Label
                  position="center"
                  content={({ viewBox }) => {
                    const { cx, cy } = (viewBox ?? {}) as {
                      cx?: number;
                      cy?: number;
                    };
                    if (cx == null || cy == null) return null;
                    return (
                      <text x={cx} y={cy} textAnchor="middle">
                        <tspan
                          x={cx}
                          dy="-0.3em"
                          className="fill-foreground"
                          fontSize={15}
                          fontWeight={700}
                        >
                          {formatCompactValue(valueKind, total)}
                        </tspan>
                        <tspan
                          x={cx}
                          dy="1.5em"
                          className="fill-muted-foreground"
                          fontSize={10}
                        >
                          total
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
              <Tooltip
                content={<CurrencyTooltip unit={unit} valueKind={valueKind} />}
              />
            </PieChart>
          </ResponsiveContainer>
          <SegmentList data={data} unit={unit} valueKind={valueKind} />
        </>
      )}
    </Card>
  );
};

export const BreakdownBar = ({
  title,
  segments,
  unit = "payment",
}: {
  title: string;
  segments: IBreakdownSegment[];
  unit?: string;
}) => {
  const sorted = segments
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const data = sorted.map((s) => ({ ...s, name: label(s.key) }));
  const totalCount = sorted.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="gap-0 p-5">
      <ChartCardHeader
        title={title}
        meta={
          data.length > 0
            ? `${totalCount} ${unit}${totalCount === 1 ? "" : "s"}`
            : undefined
        }
      />
      {data.length === 0 ? (
        <CardEmpty />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data}
              margin={{ top: 20, right: 8, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border"
                vertical={false}
              />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                width={56}
                tickFormatter={(value) => compactMoney(Number(value))}
              />
              <Tooltip content={<CurrencyTooltip unit={unit} />} />
              <Bar
                dataKey="amount"
                radius={[4, 4, 0, 0]}
                maxBarSize={80}
                isAnimationActive={false}
              >
                {data.map((entry, i) => (
                  <Cell key={entry.key} fill={PALETTE[i % PALETTE.length]} />
                ))}
                <LabelList
                  dataKey="amount"
                  position="top"
                  className="fill-foreground"
                  fontSize={11}
                  formatter={(value: React.ReactNode) =>
                    compactMoney(Number(value))
                  }
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <SegmentList data={sorted} unit={unit} />
        </>
      )}
    </Card>
  );
};

export interface TrendPoint {
  period: string;
  amount: number;
  count: number;
  previousAmount?: number;
}

/** Revenue-over-time area chart with an optional dashed previous-period line. */
export const TrendChart = ({
  title,
  data,
  unit = "booking",
}: {
  title: string;
  data: TrendPoint[];
  unit?: string;
}) => {
  const total = data.reduce((sum, p) => sum + p.amount, 0);
  const totalCount = data.reduce((sum, p) => sum + p.count, 0);
  const peak = data.reduce(
    (best: TrendPoint | undefined, p) =>
      p.amount > (best?.amount ?? -1) ? p : best,
    data[0],
  );
  const avg = data.length > 0 ? total / data.length : 0;
  const hasData = total > 0;
  const hasPrevious = data.some((p) => (p.previousAmount ?? 0) > 0);

  return (
    <Card className="gap-0 p-5">
      <ChartCardHeader
        title={title}
        meta={
          hasData
            ? `${formatMoney(total)} · ${totalCount} ${unit}${totalCount === 1 ? "" : "s"}${peak ? ` · peak ${peak.period}` : ""}`
            : undefined
        }
      />
      {!hasData ? (
        <CardEmpty />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
          >
            <defs>
              <linearGradient id="reportTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-border"
              vertical={false}
            />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              width={56}
              tickFormatter={(value) => compactMoney(Number(value))}
            />
            <Tooltip content={<CurrencyTooltip unit={unit} />} />
            {avg > 0 && (
              <ReferenceLine
                y={avg}
                strokeDasharray="4 4"
                className="stroke-muted-foreground/60"
                label={{
                  value: "avg",
                  position: "insideTopRight",
                  fontSize: 10,
                  className: "fill-muted-foreground",
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#reportTrendFill)"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              name="This period"
              isAnimationActive={false}
            />
            {hasPrevious && (
              <Line
                type="monotone"
                dataKey="previousAmount"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                name="Previous period"
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
};

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
 * The dms ranked leaderboard: rank number, name (link), amount, and a bar
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

// ---- Per-card states ------------------------------------------------------

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
