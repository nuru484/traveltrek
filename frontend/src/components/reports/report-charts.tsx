// src/components/reports/report-charts.tsx
//
// Barrel for the reports/dashboard chart primitives. The implementation is
// split into focused modules under ./report-charts:
//   primitives      — label map, compactMoney, PALETTE, TrendIndicator,
//                      CurrencyTooltip, ChartCardHeader
//   card-states     — CardEmpty, CardError
//   kpi-card        — KpiCard
//   breakdown-charts— SegmentList, BreakdownDonut, BreakdownBar
//   trend-chart     — TrendChart (+ TrendPoint)
//   ranked-bar-list — RankedBarList (+ RankedItem)
//   skeletons       — Chart/Kpi/List card skeletons
// Re-exporting here keeps every "@/components/reports/report-charts" import
// working unchanged.
export * from "./report-charts/primitives";
export * from "./report-charts/card-states";
export * from "./report-charts/kpi-card";
export * from "./report-charts/breakdown-charts";
export * from "./report-charts/trend-chart";
export * from "./report-charts/ranked-bar-list";
export * from "./report-charts/skeletons";
