"use client";
import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IToursQueryParams, TourType, TourStatus } from "@/types/tour.types";
import { useDebounce } from "@/hooks/useDebounce";

interface TourFiltersProps {
  filters: Omit<IToursQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IToursQueryParams, "page" | "limit">>
  ) => void;
}

export function TourFilters({ filters, onFiltersChange }: TourFiltersProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const handleTypeChange = (value: string) => {
    onFiltersChange({
      type: value === "all" ? undefined : (value as TourType),
    });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({
      status: value === "all" ? undefined : (value as TourStatus),
    });
  };

  const hasFiltersApplied =
    filters.search || filters.type || filters.status || filters.location;

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
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Bar */}
      <div className="relative w-full lg:max-w-xs">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by tour name or location..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tour Type Filter */}
        <Select value={filters.type || "all"} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
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

        {/* Tour Status Filter */}
        <Select
          value={filters.status || "all"}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
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

        {/* Clear Filters */}
        {hasFiltersApplied && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasFiltersApplied && (
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {filters.search && (
            <Badge variant="secondary" className="gap-2">
              Search: {filters.search}
              <button
                onClick={() => {
                  setSearchInput("");
                  onFiltersChange({ search: undefined });
                }}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                ×
              </button>
            </Badge>
          )}
          {filters.type && (
            <Badge variant="secondary" className="gap-2">
              Type: {filters.type}
              <button
                onClick={() => onFiltersChange({ type: undefined })}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                ×
              </button>
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-2">
              Status: {filters.status}
              <button
                onClick={() => onFiltersChange({ status: undefined })}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                ×
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
