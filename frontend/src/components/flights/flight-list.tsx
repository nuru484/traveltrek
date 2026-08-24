// src/components/flights/flight-list.tsx
"use client";
import React from "react";
import { FlightListItem } from "./flight-list-item";
import { IFlight, IFlightsQueryParams } from "@/types/flight.types";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorMessage from "../ui/ErrorMessage";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import Pagination from "../ui/Pagination";
import { FlightFilters } from "./FlightFilters";
import { IDestination } from "@/types/destination.types";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";
import EmptyState from "@/components/ui/EmptyState";
import { hasActiveFilterValues } from "@/utils/active-filters";

interface FlightListProps {
  toolbarActions?: React.ReactNode;
  data: IFlight[];
  isLoading: boolean;
  isError: boolean;
  error: FetchBaseQueryError | SerializedError | undefined;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: Omit<IFlightsQueryParams, "page" | "limit">;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFiltersChange: (
    filters: Partial<Omit<IFlightsQueryParams, "page" | "limit">>
  ) => void;
  onRefetch: () => void;
  destinations: IDestination[];
}

export function FlightList({
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
  destinations,
  toolbarActions,
}: FlightListProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Filters Skeleton */}
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-full lg:max-w-xs" />
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>

        {/* Flight List Skeletons */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-foreground/15 bg-card"
            >
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="space-y-3 p-4">
                <div>
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="mt-2 h-5 w-40" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="flex justify-between gap-2 border-t border-dashed border-foreground/15 pt-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-14" />
                </div>
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

  const flightCount = data?.length || 0;
  const hasActiveFilters = hasActiveFilterValues(filters);

  // No flights exist at all (not a filtered miss): a lone EmptyState replaces
  // the filter bar and results header — filters over nothing are pointless.
  if (meta.total === 0 && !hasActiveFilters) {
    return (
      <EmptyState
        title="No flights yet."
        description={
          toolbarActions
            ? "Add your first flight to start taking seat bookings."
            : "Flights will show up here once they are added."
        }
        action={toolbarActions}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <FlightFilters
        actions={toolbarActions}
        filters={filters}
        onFiltersChange={onFiltersChange}
        destinations={destinations}
      />

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">
              Available Flights
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {meta.total} flight{meta.total !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>
      </div>

      {/* Flight List */}
      {flightCount > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {data.map((flight: IFlight) => (
              <FlightListItem key={flight.id} flight={flight} />
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
          title="No flights found."
          description="Nothing matches your search criteria. Try adjusting your filters."
        />
      )}
    </div>
  );
}
