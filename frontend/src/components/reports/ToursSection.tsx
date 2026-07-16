// src/components/reports/ToursSection.tsx
//
// Tours tab: collapsed filter bar (period + tour type + tour status), then
// the analyzed-set KPI cards → the ranked top-tours leaderboard (rank +
// name link + revenue + proportional bar).
"use client";

import * as React from "react";
import { useGetTopToursByBookingsQuery } from "@/redux/reportsApi";
import { IReportsQueryParams } from "@/types/reports.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { formatMoney } from "@/utils/format-money";
import { ReportFilterBar } from "./ReportFilterBar";
import { PrintButton } from "./PrintButton";
import { LabeledSelect, PeriodField } from "./filter-fields";
import { useReportPeriod } from "./use-report-period";
import { countActiveFilters } from "./report-filters-logic";
import {
  CardError,
  KpiCard,
  KpiCardsSkeleton,
  ListCardSkeleton,
} from "./report-charts";
import { TopToursRankedCard } from "./report-lists";

const TOUR_TYPES = [
  "ADVENTURE",
  "CULTURAL",
  "BEACH",
  "CITY",
  "WILDLIFE",
  "CRUISE",
] as const;

const TOUR_STATUSES = [
  "UPCOMING",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
] as const;

type TourTypeFilter = IReportsQueryParams["tourType"];
type TourStatusFilter = IReportsQueryParams["tourStatus"];

export function ToursSection() {
  const period = useReportPeriod();
  const [tourType, setTourType] = React.useState<TourTypeFilter>();
  const [tourStatus, setTourStatus] = React.useState<TourStatusFilter>();

  // No limit/minBookings knobs — the API defaults (10 / 1) are the contract.
  const params = React.useMemo<IReportsQueryParams>(
    () => ({ ...period.dateParams, tourType, tourStatus }),
    [period.dateParams, tourType, tourStatus],
  );

  const { data, isLoading, isError, error, refetch } =
    useGetTopToursByBookingsQuery(params);

  const filterCount = countActiveFilters(period.selection, [
    tourType,
    tourStatus,
  ]);
  const clearAll = () => {
    setTourType(undefined);
    setTourStatus(undefined);
    period.reset();
  };

  const errorMessage = extractApiErrorMessage(error).message;
  const report = data?.data;

  return (
    <div className="space-y-4">
      <ReportFilterBar
        controlCount={3}
        filterColumns={3}
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
              label="Tour type"
              value={tourType}
              options={TOUR_TYPES}
              onChange={(value) =>
                setTourType(
                  value === "all" ? undefined : (value as TourTypeFilter),
                )
              }
            />
            <LabeledSelect
              label="Tour status"
              value={tourStatus}
              options={TOUR_STATUSES}
              onChange={(value) =>
                setTourStatus(
                  value === "all" ? undefined : (value as TourStatusFilter),
                )
              }
            />
          </>
        }
      />

      <div className="report-print-area space-y-4">
        {/* Analyzed-set KPIs */}
        {isLoading ? (
          <KpiCardsSkeleton count={3} />
        ) : isError || !report ? (
          <CardError
            title="Analysis summary"
            message={errorMessage || "Failed to load tour analysis"}
            onRetry={refetch}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              title="Tours analyzed"
              code="TRS"
              value={report.summary.totalToursAnalyzed.toLocaleString()}
            />
            <KpiCard
              title="Bookings analyzed"
              code="BKG"
              value={report.summary.totalBookingsAnalyzed.toLocaleString()}
            />
            <KpiCard
              title="Revenue analyzed"
              code="REV"
              value={formatMoney(report.summary.totalRevenueAnalyzed)}
            />
          </div>
        )}

        {/* Ranked leaderboard */}
        {isLoading ? (
          <ListCardSkeleton title="Top tours by bookings" rows={6} />
        ) : isError || !report ? (
          <CardError
            title="Top tours by bookings"
            message={errorMessage || "Failed to load top tours"}
            onRetry={refetch}
          />
        ) : (
          <TopToursRankedCard topTours={report.topTours} />
        )}
      </div>
    </div>
  );
}
