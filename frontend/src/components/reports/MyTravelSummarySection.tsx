// src/components/reports/MyTravelSummarySection.tsx
//
// "My travel summary" — the customer's own /reports/me: KPI cards, a
// spend-over-time trend, a booked-item-type breakdown and recent bookings.
// One query drives every card; the period filter renders inline (single
// control, under the filter-bar inline threshold).
"use client";

import * as React from "react";
import { useGetMyReportQuery } from "@/redux/reportsApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { formatMoney } from "@/utils/format-money";
import { ReportFilterBar } from "./ReportFilterBar";
import { PrintButton } from "./PrintButton";
import { PeriodField } from "./filter-fields";
import { useReportPeriod } from "./use-report-period";
import { countActiveFilters } from "./report-filters-logic";
import {
  selfByTypeSegments,
  selfSpendTrendPoints,
  toBookingSummaries,
} from "./report-data";
import {
  BreakdownDonut,
  CardError,
  ChartCardSkeleton,
  KpiCard,
  KpiCardsSkeleton,
  ListCardSkeleton,
  TrendChart,
} from "./report-charts";
import { RecentBookingsCard } from "./report-lists";

export function MyTravelSummarySection() {
  const period = useReportPeriod();

  const { data, isLoading, isError, error, refetch } = useGetMyReportQuery(
    period.dateParams
  );

  const filterCount = countActiveFilters(period.selection, []);
  const errorMessage = extractApiErrorMessage(error).message;
  const report = data?.data;

  return (
    <div className="space-y-4">
      <ReportFilterBar
        controlCount={1}
        filterCount={filterCount}
        hasFiltersApplied={filterCount > 0}
        onClearAll={period.reset}
        actions={<PrintButton />}
        filterFields={
          <PeriodField
            selection={period.selection}
            onSelectionChange={period.onSelectionChange}
            customStart={period.customStart}
            customEnd={period.customEnd}
            onCustomStartChange={period.onCustomStartChange}
            onCustomEndChange={period.onCustomEndChange}
            onApplyCustom={period.applyCustom}
          />
        }
      />

      <div className="report-print-area space-y-4">
        {/* KPI row */}
        {isLoading ? (
          <KpiCardsSkeleton count={4} />
        ) : isError || !report ? (
          <CardError
            title="My travel summary"
            message={errorMessage || "Failed to load your travel summary"}
            onRetry={refetch}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Trips taken"
              code="TRP"
              value={report.summary.totalTrips.toLocaleString()}
              sub="Completed bookings in this period"
            />
            <KpiCard
              title="Upcoming trips"
              code="UPC"
              value={report.summary.upcomingTrips.toLocaleString()}
              sub="Booked and still ahead"
            />
            <KpiCard
              title="Total spent"
              code="SPD"
              value={formatMoney(report.summary.totalSpent)}
              sub={`Avg booking ${formatMoney(
                report.summary.averageBookingValue
              )}`}
            />
            <KpiCard
              title="Cancelled"
              code="CXL"
              value={report.summary.cancelledBookings.toLocaleString()}
              sub="Bookings cancelled in this period"
            />
          </div>
        )}

        {/* Spend trend */}
        {isLoading ? (
          <ChartCardSkeleton title="Spend over time" height={280} />
        ) : isError || !report ? (
          <CardError
            title="Spend over time"
            message={errorMessage || "Failed to load trend"}
            onRetry={refetch}
          />
        ) : (
          <TrendChart
            title="Spend over time"
            data={selfSpendTrendPoints(report.monthlySpend)}
          />
        )}

        {/* Type breakdown + recent bookings */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isLoading ? (
            <ChartCardSkeleton title="Spending by trip type" />
          ) : isError || !report ? (
            <CardError
              title="Spending by trip type"
              message={errorMessage || "Failed to load breakdown"}
              onRetry={refetch}
            />
          ) : (
            <BreakdownDonut
              title="Spending by trip type"
              segments={selfByTypeSegments(report.byType)}
            />
          )}

          {isLoading ? (
            <ListCardSkeleton title="Recent bookings" />
          ) : isError || !report ? (
            <CardError
              title="Recent bookings"
              message={errorMessage || "Failed to load bookings"}
              onRetry={refetch}
            />
          ) : (
            <RecentBookingsCard
              bookings={toBookingSummaries(report.recentBookings)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
