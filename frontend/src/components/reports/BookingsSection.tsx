// src/components/reports/BookingsSection.tsx
//
// Bookings tab: collapsed filter bar (period + booking status), then KPI
// cards with trends → monthly trend area chart + status donut → recent
// bookings. Every card renders its own skeleton/error/empty state.
"use client";

import * as React from "react";
import { useGetMonthlyBookingsSummaryQuery } from "@/redux/reportsApi";
import { IReportsQueryParams } from "@/types/reports.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { formatMoney } from "@/utils/format-money";
import { ReportFilterBar } from "./ReportFilterBar";
import { PrintButton } from "./PrintButton";
import { LabeledSelect, PeriodField } from "./filter-fields";
import { useReportPeriod } from "./use-report-period";
import { countActiveFilters } from "./report-filters-logic";
import { bookingStatusSegments, bookingsTrendPoints } from "./report-data";
import {
  BreakdownDonut,
  CardError,
  ChartCardSkeleton,
  KpiCard,
  KpiCardsSkeleton,
  ListCardSkeleton,
  TrendChart,
  TrendIndicator,
} from "./report-charts";
import { RecentBookingsCard } from "./report-lists";

const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
] as const;

type BookingStatusFilter = IReportsQueryParams["status"];

export function BookingsSection() {
  const period = useReportPeriod();
  const [status, setStatus] = React.useState<BookingStatusFilter>();

  const params = React.useMemo<IReportsQueryParams>(
    () => ({ ...period.dateParams, status }),
    [period.dateParams, status],
  );

  const { data, isLoading, isError, error, refetch } =
    useGetMonthlyBookingsSummaryQuery(params);

  const filterCount = countActiveFilters(period.selection, [status]);
  const clearAll = () => {
    setStatus(undefined);
    period.reset();
  };

  const errorMessage = extractApiErrorMessage(error).message;
  const report = data?.data;

  return (
    <div className="space-y-4">
      <ReportFilterBar
        controlCount={2}
        filterColumns={2}
        filterCount={filterCount}
        hasFiltersApplied={filterCount > 0}
        onClearAll={clearAll}
        actions={<PrintButton />}
        filterFields={
          <>
            <PeriodField
              selection={period.selection}
              onSelectionChange={period.onSelectionChange}
              customStart={period.customStart}
              customEnd={period.customEnd}
              onCustomStartChange={period.onCustomStartChange}
              onCustomEndChange={period.onCustomEndChange}
              onApplyCustom={period.applyCustom}
            />
            <LabeledSelect
              label="Booking status"
              value={status}
              options={BOOKING_STATUSES}
              onChange={(value) =>
                setStatus(
                  value === "all" ? undefined : (value as BookingStatusFilter),
                )
              }
            />
          </>
        }
      />

      <div className="report-print-area space-y-4">
        {/* KPI row */}
        {isLoading ? (
          <KpiCardsSkeleton count={3} />
        ) : isError || !report ? (
          <CardError
            title="Summary"
            message={errorMessage || "Failed to load booking KPIs"}
            onRetry={refetch}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              title="Total bookings"
              code="BKG"
              value={report.summary.totalBookings.toLocaleString()}
              sub={<TrendIndicator {...report.summary.trends.totalBookings} />}
            />
            <KpiCard
              title="Total revenue"
              code="REV"
              value={formatMoney(report.summary.totalRevenue)}
              sub={<TrendIndicator {...report.summary.trends.totalRevenue} />}
            />
            <KpiCard
              title="Avg booking value"
              code="AVG"
              value={formatMoney(report.summary.averageBookingValue)}
              sub={
                <TrendIndicator {...report.summary.trends.averageBookingValue} />
              }
            />
          </div>
        )}

        {/* Trend */}
        {isLoading ? (
          <ChartCardSkeleton title="Bookings over time" height={280} />
        ) : isError || !report ? (
          <CardError
            title="Bookings over time"
            message={errorMessage || "Failed to load trend"}
            onRetry={refetch}
          />
        ) : (
          <TrendChart
            title="Bookings over time"
            data={bookingsTrendPoints(report.monthlyBreakdown)}
          />
        )}

        {/* Status donut + recent bookings */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isLoading ? (
            <ChartCardSkeleton title="By status" />
          ) : isError || !report ? (
            <CardError
              title="By status"
              message={errorMessage || "Failed to load breakdown"}
              onRetry={refetch}
            />
          ) : (
            <BreakdownDonut
              title="By status"
              segments={bookingStatusSegments(report.statusBreakdown)}
              valueKind="count"
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
            <RecentBookingsCard bookings={report.bookings} />
          )}
        </div>
      </div>
    </div>
  );
}
