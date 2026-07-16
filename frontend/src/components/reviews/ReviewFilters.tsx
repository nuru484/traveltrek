// src/components/reviews/ReviewFilters.tsx
"use client";
import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterBar } from "@/components/ui/FilterBar";
import type { IReviewsQueryParams, ReviewStatus } from "@/types/review.types";
import { useDebounce } from "@/hooks/useDebounce";

interface ReviewFiltersProps {
  filters: Omit<IReviewsQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IReviewsQueryParams, "page" | "limit">>
  ) => void;
}

const STATUSES: ReviewStatus[] = ["PENDING", "PUBLISHED", "HIDDEN"];

export function ReviewFilters({
  filters,
  onFiltersChange,
}: ReviewFiltersProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const activeCount = [filters.status, filters.rating].filter(
    (value) => value !== undefined
  ).length;

  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange({
      search: undefined,
      status: undefined,
      rating: undefined,
    });
  };

  return (
    <FilterBar
      search={searchInput}
      onSearch={setSearchInput}
      searchPlaceholder="Search title, comment or reviewer…"
      activeCount={activeCount}
      onClear={clearFilters}
    >
      <Select
        value={filters.status || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            status: value === "all" ? undefined : (value as ReviewStatus),
          })
        }
      >
        <SelectTrigger className="w-full lg:w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.rating !== undefined ? String(filters.rating) : "all"}
        onValueChange={(value) =>
          onFiltersChange({
            rating: value === "all" ? undefined : Number(value),
          })
        }
      >
        <SelectTrigger className="w-full lg:w-[150px]">
          <SelectValue placeholder="Rating" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Ratings</SelectItem>
          {[5, 4, 3, 2, 1].map((rating) => (
            <SelectItem key={rating} value={String(rating)}>
              {rating} Star{rating > 1 ? "s" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
