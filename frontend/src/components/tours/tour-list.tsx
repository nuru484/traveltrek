// src/components/tours/tour-list.tsx
"use client";
import React from "react";
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
import { hasActiveFilterValues } from "@/utils/active-filters";

interface TourListProps {
  toolbarActions?: React.ReactNode;
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
  onRefetch,
  toolbarActions,
}: TourListProps) {
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
              className="flex flex-col gap-3 rounded-xl border border-foreground/15 bg-card p-4 sm:p-5"
            >
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div>
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-2 h-5 w-3/4" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="mt-auto flex justify-between gap-2 border-t border-dashed border-foreground/15 pt-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
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
  const hasActiveFilters = hasActiveFilterValues(filters);

  // No tours exist at all (not a filtered miss): a lone EmptyState replaces
  // the filter bar and results header — filters over nothing are pointless.
  if (meta.total === 0 && !hasActiveFilters) {
    return (
      <EmptyState
        title="No tours yet."
        description={
          toolbarActions
            ? "Create your first tour package to start taking bookings."
            : "Tour packages will show up here once they are added."
        }
        action={toolbarActions}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <TourFilters filters={filters} onFiltersChange={onFiltersChange} actions={toolbarActions} />

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
