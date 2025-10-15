// src/components/tours/tour-list.tsx
"use client";
import { TourListItem } from "./tour-list-item";
import { ITour, IToursQueryParams } from "@/types/tour.types";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Search } from "lucide-react";
import ErrorMessage from "../ui/ErrorMessage";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import Pagination from "../ui/Pagination";
import { TourFilters } from "./TourFilters";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";

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
  onRefetch,
}: TourListProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Filters Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-[180px]" />
            <Skeleton className="h-10 w-[180px]" />
          </div>
        </div>

        {/* Tour List Skeletons */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
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
          <div className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center hidden sm:flex">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
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
          <div className="space-y-4">
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
        <div className="text-center py-16">
          <div className="max-w-md mx-auto px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No Tours Found
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              No tours match your search criteria. Try adjusting your filters.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
