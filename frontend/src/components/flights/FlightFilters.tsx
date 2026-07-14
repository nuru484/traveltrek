// src/components/flights/FlightFilters.tsx
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
import { IFlightsQueryParams, IFlightClass } from "@/types/flight.types";
import { useDebounce } from "@/hooks/useDebounce";
import { IDestination } from "@/types/destination.types";

interface FlightFiltersProps {
  filters: Omit<IFlightsQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IFlightsQueryParams, "page" | "limit">>
  ) => void;
  destinations: IDestination[];
}

export function FlightFilters({
  filters,
  onFiltersChange,
  destinations,
}: FlightFiltersProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const handleFlightClassChange = (value: string) => {
    onFiltersChange({
      flightClass: value === "all" ? undefined : (value as IFlightClass),
    });
  };

  const handleOriginChange = (value: string) => {
    onFiltersChange({
      originId: value === "all" ? undefined : parseInt(value),
    });
  };

  const handleDestinationChange = (value: string) => {
    onFiltersChange({
      destinationId: value === "all" ? undefined : parseInt(value),
    });
  };

  const hasFiltersApplied =
    filters.search ||
    filters.airline ||
    filters.flightClass ||
    filters.originId ||
    filters.destinationId;

  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange({
      search: undefined,
      airline: undefined,
      flightClass: undefined,
      originId: undefined,
      destinationId: undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Bar */}
      <div className="relative w-full lg:max-w-xs">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by flight number or airline..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Origin Filter */}
        <Select
          value={filters.originId?.toString() || "all"}
          onValueChange={handleOriginChange}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Origin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Origins</SelectItem>
            {destinations.map((dest) => (
              <SelectItem key={dest.id} value={dest.id.toString()}>
                {dest.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Destination Filter */}
        <Select
          value={filters.destinationId?.toString() || "all"}
          onValueChange={handleDestinationChange}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Destination" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Destinations</SelectItem>
            {destinations.map((dest) => (
              <SelectItem key={dest.id} value={dest.id.toString()}>
                {dest.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Flight Class Filter */}
        <Select
          value={filters.flightClass || "all"}
          onValueChange={handleFlightClassChange}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            <SelectItem value="ECONOMY">Economy</SelectItem>
            <SelectItem value="BUSINESS">Business</SelectItem>
            <SelectItem value="FIRST_CLASS">First Class</SelectItem>
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
          {filters.flightClass && (
            <Badge variant="secondary" className="gap-2">
              Class: {filters.flightClass}
              <button
                onClick={() => onFiltersChange({ flightClass: undefined })}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                ×
              </button>
            </Badge>
          )}
          {filters.originId && (
            <Badge variant="secondary" className="gap-2">
              Origin:{" "}
              {destinations.find((d) => d.id === filters.originId)?.city}
              <button
                onClick={() => onFiltersChange({ originId: undefined })}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                ×
              </button>
            </Badge>
          )}
          {filters.destinationId && (
            <Badge variant="secondary" className="gap-2">
              Destination:{" "}
              {destinations.find((d) => d.id === filters.destinationId)?.city}
              <button
                onClick={() => onFiltersChange({ destinationId: undefined })}
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
