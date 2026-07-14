// src/components/destinations/DestinationList.tsx
"use client";
import { DestinationListItem } from "./DestinationListItem";
import {
  IDestination,
  IDestinationQueryParams } from "@/types/destination.types";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorMessage from "../ui/ErrorMessage";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import Pagination from "../ui/Pagination";
import { DestinationFilters } from "./DestinationFilters";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";
import EmptyState from "@/components/ui/EmptyState";

interface DestinationListProps {
  data: IDestination[];
  isLoading: boolean;
  isError: boolean;
  error: FetchBaseQueryError | SerializedError | undefined;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: Omit<IDestinationQueryParams, "page" | "limit">;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFiltersChange: (
    filters: Partial<Omit<IDestinationQueryParams, "page" | "limit">>
  ) => void;
  onRefetch: () => void;
  countries: string[];
  cities: string[];
}

export default function DestinationList({
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
  countries,
  cities }: DestinationListProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Filters Skeleton */}
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-full lg:max-w-xs" />
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>

        {/* Destination List Skeletons */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-foreground/15 bg-card"
            >
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-16 w-full rounded-lg" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-9 flex-1 rounded-full" />
                  <Skeleton className="h-9 flex-1 rounded-full" />
                  <Skeleton className="h-9 flex-1 rounded-full" />
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

  const destinationCount = data?.length || 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <DestinationFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        countries={countries}
        cities={cities}
      />

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">
              Available Destinations
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {meta.total} destination{meta.total !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>
      </div>

      {/* Destination List */}
      {destinationCount > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {data.map((destination: IDestination) => (
              <DestinationListItem
                key={destination.id}
                destination={destination}
              />
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
          title="No destinations found."
          description="Nothing matches your search criteria. Try adjusting your filters."
        />
      )}
    </div>
  );
}
