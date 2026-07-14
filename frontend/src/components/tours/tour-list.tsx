// src/components/tours/tour-list.tsx
"use client";
import { TourListItem } from "./tour-list-item";
import { ITour, IToursQueryParams } from "@/types/tour.types";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorMessage from "../ui/ErrorMessage";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import Pagination from "../ui/Pagination";
import { TourFilters } from "./TourFilters";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";
import EmptyState from "@/components/ui/EmptyState";

interface TourListProps {
  data: ITour[];
  isLoading: boolean;
  isError: boolean;
  error: FetchBaseQueryError | SerializedError | undefined;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: Omit<IToursQueryParams, "page" | "limit">;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFiltersChange: (
    filters: Partial<Omit<IToursQueryParams, "page" | "limit">>
  ) => void;
  onRefetch: () => void;
}

export function TourList({
  data,
  isLoading,
  isError,
  error,
  meta,
  filters,
  onPageChange,
  onLimitChange,
  onFiltersChange,
  onRefetch }: TourListProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Filters Skeleton */}
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-full lg:max-w-xs" />
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>

        {/* Tour List Skeletons */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-foreground/15 bg-card p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-14 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-14 w-full rounded-lg" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-8 flex-1 rounded-full" />
                <Skeleton className="h-8 flex-1 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = extractApiErrorMessage(error).message;
    return <ErrorMessage error={errorMessage} onRetry={onRefetch} />;
  }

  const tourCount = data?.length || 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <TourFilters filters={filters} onFiltersChange={onFiltersChange} />

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">
              Available Tours
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {meta.total} tour{meta.total !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>
      </div>

      {/* Tour List */}
      {tourCount > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {data.map((tour: ITour) => (
              <TourListItem key={tour.id} tour={tour} />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            meta={meta}
            onPageChange={onPageChange}
            onLimitChange={onLimitChange}
            showPageSizeSelector={true}
            pageSizeOptions={[10, 25, 50]}
          />
        </>
      ) : (
        <EmptyState
          eyebrow="No results"
          title="No tours found."
          description="Nothing matches your search criteria. Try adjusting your filters."
        />
      )}
    </div>
  );
}
