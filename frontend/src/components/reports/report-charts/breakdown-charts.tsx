// src/components/reports/report-charts/breakdown-charts.tsx
//
// Category breakdowns: the per-segment detail list plus the donut and bar
// renderings that sit above it. Colours come from the fixed PALETTE so the
// chart and its SegmentList line up. Money values are integer pesewas.
"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  Label,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/utils/format-money";
import { IBreakdownSegment } from "@/types/reports.types";
import {
  ChartCardHeader,
  CurrencyTooltip,
  PALETTE,
  SegmentValueKind,
  compactMoney,
  formatCompactValue,
  label,
} from "./primitives";
import { CardEmpty } from "./card-states";

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
