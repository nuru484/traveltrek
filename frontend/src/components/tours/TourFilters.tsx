// src/components/tours/TourFilters.tsx
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
import { IToursQueryParams, TourType, TourStatus } from "@/types/tour.types";
import { useDebounce } from "@/hooks/useDebounce";

interface TourFiltersProps {
  filters: Omit<IToursQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IToursQueryParams, "page" | "limit">>
  ) => void;
  /** Page actions (Create) rendered inside the toolbar. */
  actions?: React.ReactNode;
}

export function TourFilters({
  filters,
  onFiltersChange,
  actions,
}: TourFiltersProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const activeCount = [filters.type, filters.status].filter(Boolean).length;

  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange({
      search: undefined,
      type: undefined,
      status: undefined,
      location: undefined,
    });
  };

  return (
    <FilterBar
      search={searchInput}
      onSearch={setSearchInput}
      searchPlaceholder="Search by tour name or location…"
      activeCount={activeCount}
      onClear={clearFilters}
      actions={actions}
    >
      <Select
        value={filters.type || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            type: value === "all" ? undefined : (value as TourType),
          })
        }
      >
        <SelectTrigger className="w-full lg:w-[150px]">
          <SelectValue placeholder="Tour Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value={TourType.ADVENTURE}>Adventure</SelectItem>
          <SelectItem value={TourType.CULTURAL}>Cultural</SelectItem>
          <SelectItem value={TourType.BEACH}>Beach</SelectItem>
          <SelectItem value={TourType.CITY}>City</SelectItem>
          <SelectItem value={TourType.WILDLIFE}>Wildlife</SelectItem>
          <SelectItem value={TourType.CRUISE}>Cruise</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.status || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            status: value === "all" ? undefined : (value as TourStatus),
          })
        }
      >
        <SelectTrigger className="w-full lg:w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value={TourStatus.UPCOMING}>Upcoming</SelectItem>
          <SelectItem value={TourStatus.ONGOING}>Ongoing</SelectItem>
          <SelectItem value={TourStatus.COMPLETED}>Completed</SelectItem>
          <SelectItem value={TourStatus.CANCELLED}>Cancelled</SelectItem>
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
