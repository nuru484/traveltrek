// src/components/reports/OverviewSection.tsx
//
// Overview tab: period control only, then a cross-domain read built from the
// three report queries — each card row is bound to exactly one query, so a
// failing slice never blanks the rest of the tab.
"use client";

import * as React from "react";
import {
  useGetMonthlyBookingsSummaryQuery,
  useGetPaymentsSummaryQuery,
  useGetTopToursByBookingsQuery,
} from "@/redux/reportsApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { formatMoney } from "@/utils/format-money";
import { ReportFilterBar } from "./ReportFilterBar";
import { PrintButton } from "./PrintButton";
import { PeriodField } from "./filter-fields";
import { useReportPeriod } from "./use-report-period";
import { countActiveFilters } from "./report-filters-logic";
import {
  bookingStatusSegments,
  bookingsTrendPoints,
  paymentMethodSegments,
} from "./report-data";
import {
  BreakdownBar,
  BreakdownDonut,
  CardError,
  ChartCardSkeleton,
  KpiCard,
  KpiCardSkeleton,
  ListCardSkeleton,
  TrendChart,
  TrendIndicator,
} from "./report-charts";
import { RecentBookingsCard, TopToursRankedCard } from "./report-lists";

export function OverviewSection() {
  const period = useReportPeriod();
  const params = period.dateParams;

  const bookingsQuery = useGetMonthlyBookingsSummaryQuery(params);
  const paymentsQuery = useGetPaymentsSummaryQuery(params);
  const toursQuery = useGetTopToursByBookingsQuery(params);

  const filterCount = countActiveFilters(period.selection, []);
  const bookingsError = extractApiErrorMessage(bookingsQuery.error).message;
  const paymentsError = extractApiErrorMessage(paymentsQuery.error).message;
  const toursError = extractApiErrorMessage(toursQuery.error).message;

  const bookings = bookingsQuery.data?.data;
  const payments = paymentsQuery.data?.data;
  const tours = toursQuery.data?.data;

  return (
    <div className="space-y-4">
      <ReportFilterBar
        filterColumns={2}
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
        {/* KPI row — bookings pair and payments pair each own their query. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bookingsQuery.isLoading ? (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          ) : bookingsQuery.isError || !bookings ? (
            <div className="sm:col-span-2">
              <CardError
                title="Bookings"
                message={bookingsError || "Failed to load booking KPIs"}
                onRetry={bookingsQuery.refetch}
              />
            </div>
          ) : (
            <>
              <KpiCard
                title="Total bookings"
                code="BKG"
                value={bookings.summary.totalBookings.toLocaleString()}
                sub={
                  <TrendIndicator {...bookings.summary.trends.totalBookings} />
                }
              />
              <KpiCard
                title="Avg booking value"
                code="AVG"
                value={formatMoney(bookings.summary.averageBookingValue)}
                sub={
                  <TrendIndicator
                    {...bookings.summary.trends.averageBookingValue}
                  />
                }
              />
            </>
          )}

          {paymentsQuery.isLoading ? (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          ) : paymentsQuery.isError || !payments ? (
            <div className="sm:col-span-2">
              <CardError
                title="Payments"
                message={paymentsError || "Failed to load payment KPIs"}
                onRetry={paymentsQuery.refetch}
              />
            </div>
          ) : (
            <>
              <KpiCard
                title="Total revenue"
                code="REV"
                value={formatMoney(payments.summary.totalRevenue)}
                sub={
                  <TrendIndicator {...payments.summary.trends.totalRevenue} />
                }
              />
              <KpiCard
                title="Pending amount"
                code="PND"
                value={formatMoney(payments.summary.pendingAmount)}
                sub={
                  <TrendIndicator {...payments.summary.trends.pendingAmount} />
                }
              />
            </>
          )}
        </div>

        {/* Trend */}
        {bookingsQuery.isLoading ? (
          <ChartCardSkeleton title="Bookings over time" height={280} />
        ) : bookingsQuery.isError || !bookings ? (
          <CardError
            title="Bookings over time"
            message={bookingsError || "Failed to load trend"}
            onRetry={bookingsQuery.refetch}
          />
        ) : (
          <TrendChart
            title="Bookings over time"
            data={bookingsTrendPoints(bookings.monthlyBreakdown)}
          />
        )}

        {/* Status donut + method bar */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {bookingsQuery.isLoading ? (
            <ChartCardSkeleton title="Bookings by status" />
          ) : bookingsQuery.isError || !bookings ? (
            <CardError
              title="Bookings by status"
              message={bookingsError || "Failed to load breakdown"}
              onRetry={bookingsQuery.refetch}
            />
          ) : (
            <BreakdownDonut
              title="Bookings by status"
              segments={bookingStatusSegments(bookings.statusBreakdown)}
              valueKind="count"
            />
          )}

          {paymentsQuery.isLoading ? (
            <ChartCardSkeleton title="Payments by method" />
          ) : paymentsQuery.isError || !payments ? (
            <CardError
              title="Payments by method"
              message={paymentsError || "Failed to load breakdown"}
              onRetry={paymentsQuery.refetch}
            />
          ) : (
            <BreakdownBar
              title="Payments by method"
              segments={paymentMethodSegments(payments.methodBreakdown)}
              unit="payment"
            />
          )}
        </div>

        {/* Lists */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {bookingsQuery.isLoading ? (
            <ListCardSkeleton title="Recent bookings" />
          ) : bookingsQuery.isError || !bookings ? (
            <CardError
              title="Recent bookings"
              message={bookingsError || "Failed to load bookings"}
              onRetry={bookingsQuery.refetch}
            />
          ) : (
            <RecentBookingsCard bookings={bookings.bookings} />
          )}

          {toursQuery.isLoading ? (
            <ListCardSkeleton title="Top tours by bookings" rows={6} />
          ) : toursQuery.isError || !tours ? (
            <CardError
              title="Top tours by bookings"
              message={toursError || "Failed to load top tours"}
              onRetry={toursQuery.refetch}
            />
          ) : (
            <TopToursRankedCard topTours={tours.topTours} />
          )}
        </div>
      </div>
    </div>
  );
}
