// src/components/reports/report-charts/trend-chart.tsx
//
// Revenue-over-time area chart with an optional dashed previous-period line
// and an average reference line. Money values are integer pesewas.
"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/utils/format-money";
import { ChartCardHeader, CurrencyTooltip, compactMoney } from "./primitives";
import { CardEmpty } from "./card-states";

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
