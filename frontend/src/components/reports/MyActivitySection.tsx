// src/components/reports/MyActivitySection.tsx
//
// "My activity" — a staff member's /reports/agent-activity: bookings they
// recorded on behalf of customers, the revenue/pipeline those produced, and
// the customers served. Agents are pinned to themselves server-side; the
// period filter renders inline (single control).
"use client";

import * as React from "react";
import { useGetAgentActivityQuery } from "@/redux/reportsApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { formatMoney } from "@/utils/format-money";
import { ReportFilterBar } from "./ReportFilterBar";
import { PrintButton } from "./PrintButton";
import { PeriodField } from "./filter-fields";
import { useReportPeriod } from "./use-report-period";
import { countActiveFilters } from "./report-filters-logic";
import { agentActivityTrendPoints, toBookingSummaries } from "./report-data";
import {
  CardError,
  ChartCardSkeleton,
  KpiCard,
  KpiCardsSkeleton,
  ListCardSkeleton,
  TrendChart,
} from "./report-charts";
import { RecentBookingsCard } from "./report-lists";

export function MyActivitySection() {
  const period = useReportPeriod();

  const { data, isLoading, isError, error, refetch } =
    useGetAgentActivityQuery(period.dateParams);

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
            title="My activity"
            message={errorMessage || "Failed to load your activity"}
            onRetry={refetch}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Bookings recorded"
              code="BKG"
              value={report.summary.bookingsRecorded.toLocaleString()}
              sub="Recorded on behalf of customers"
            />
            <KpiCard
              title="Revenue"
              code="REV"
              value={formatMoney(report.summary.revenueFromRecorded)}
              sub="Completed payments on recorded bookings"
            />
            <KpiCard
              title="Pending pipeline"
              code="PND"
              value={formatMoney(report.summary.pendingFromRecorded)}
              sub="Recorded bookings still pending"
            />
            <KpiCard
              title="Customers served"
              code="CST"
              value={report.summary.customersServed.toLocaleString()}
              sub="Distinct customers in this period"
            />
          </div>
        )}

        {/* Trend */}
        {isLoading ? (
          <ChartCardSkeleton title="Recorded revenue over time" height={280} />
        ) : isError || !report ? (
          <CardError
            title="Recorded revenue over time"
            message={errorMessage || "Failed to load trend"}
            onRetry={refetch}
          />
        ) : (
          <TrendChart
            title="Recorded revenue over time"
            data={agentActivityTrendPoints(report.monthly)}
          />
        )}

        {/* Recent bookings */}
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
  );
}
