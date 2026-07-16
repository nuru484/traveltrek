// src/components/reports/PaymentsSection.tsx
//
// Payments tab: collapsed filter bar (period + payment method), then KPI
// cards with trends → revenue trend chart → status donut + method bar →
// recent payments. Every card renders its own skeleton/error/empty state.
"use client";

import * as React from "react";
import { useGetPaymentsSummaryQuery } from "@/redux/reportsApi";
import { IReportsQueryParams } from "@/types/reports.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { formatMoney } from "@/utils/format-money";
import { ReportFilterBar } from "./ReportFilterBar";
import { PrintButton } from "./PrintButton";
import { LabeledSelect, PeriodField } from "./filter-fields";
import { useReportPeriod } from "./use-report-period";
import { countActiveFilters } from "./report-filters-logic";
import {
  paymentMethodSegments,
  paymentStatusSegments,
  paymentsTrendPoints,
} from "./report-data";
import {
  BreakdownBar,
  BreakdownDonut,
  CardError,
  ChartCardSkeleton,
  KpiCard,
  KpiCardsSkeleton,
  ListCardSkeleton,
  TrendChart,
  TrendIndicator,
} from "./report-charts";
import { RecentPaymentsCard } from "./report-lists";

const PAYMENT_METHODS = [
  "CREDIT_CARD",
  "DEBIT_CARD",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
] as const;

type PaymentMethodFilter = IReportsQueryParams["paymentMethod"];

export function PaymentsSection() {
  const period = useReportPeriod();
  const [paymentMethod, setPaymentMethod] =
    React.useState<PaymentMethodFilter>();

  const params = React.useMemo<IReportsQueryParams>(
    () => ({ ...period.dateParams, paymentMethod }),
    [period.dateParams, paymentMethod],
  );

  const { data, isLoading, isError, error, refetch } =
    useGetPaymentsSummaryQuery(params);

  const filterCount = countActiveFilters(period.selection, [paymentMethod]);
  const clearAll = () => {
    setPaymentMethod(undefined);
    period.reset();
  };

  const errorMessage = extractApiErrorMessage(error).message;
  const report = data?.data;

  return (
    <div className="space-y-4">
      <ReportFilterBar
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
              label="Payment method"
              value={paymentMethod}
              options={PAYMENT_METHODS}
              onChange={(value) =>
                setPaymentMethod(
                  value === "all" ? undefined : (value as PaymentMethodFilter),
                )
              }
            />
          </>
        }
      />

      <div className="report-print-area space-y-4">
        {/* KPI row */}
        {isLoading ? (
          <KpiCardsSkeleton count={4} />
        ) : isError || !report ? (
          <CardError
            title="Summary"
            message={errorMessage || "Failed to load payment KPIs"}
            onRetry={refetch}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total revenue"
              code="REV"
              value={formatMoney(report.summary.totalRevenue)}
              sub={<TrendIndicator {...report.summary.trends.totalRevenue} />}
            />
            <KpiCard
              title="Payments"
              code="PAY"
              value={report.summary.totalPayments.toLocaleString()}
              sub={<TrendIndicator {...report.summary.trends.totalPayments} />}
            />
            <KpiCard
              title="Pending amount"
              code="PND"
              value={formatMoney(report.summary.pendingAmount)}
              sub={<TrendIndicator {...report.summary.trends.pendingAmount} />}
            />
            <KpiCard
              title="Failed amount"
              code="FLD"
              value={formatMoney(report.summary.failedAmount)}
              sub={<TrendIndicator {...report.summary.trends.failedAmount} />}
            />
          </div>
        )}

        {/* Trend */}
        {isLoading ? (
          <ChartCardSkeleton title="Revenue over time" height={280} />
        ) : isError || !report ? (
          <CardError
            title="Revenue over time"
            message={errorMessage || "Failed to load trend"}
            onRetry={refetch}
          />
        ) : (
          <TrendChart
            title="Revenue over time"
            data={paymentsTrendPoints(report.monthlyBreakdown)}
            unit="payment"
          />
        )}

        {/* Breakdowns */}
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
              segments={paymentStatusSegments(report.statusBreakdown)}
              unit="payment"
            />
          )}

          {isLoading ? (
            <ChartCardSkeleton title="By method" />
          ) : isError || !report ? (
            <CardError
              title="By method"
              message={errorMessage || "Failed to load breakdown"}
              onRetry={refetch}
            />
          ) : (
            <BreakdownBar
              title="By method"
              segments={paymentMethodSegments(report.methodBreakdown)}
              unit="payment"
            />
          )}
        </div>

        {/* Recent payments */}
        {isLoading ? (
          <ListCardSkeleton title="Recent payments" />
        ) : isError || !report ? (
          <CardError
            title="Recent payments"
            message={errorMessage || "Failed to load payments"}
            onRetry={refetch}
          />
        ) : (
          <RecentPaymentsCard payments={report.recentPayments} />
        )}
      </div>
    </div>
  );
}
