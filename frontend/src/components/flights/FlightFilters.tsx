// src/components/flights/FlightFilters.tsx
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
import { IFlightsQueryParams, IFlightClass } from "@/types/flight.types";
import { useDebounce } from "@/hooks/useDebounce";
import { IDestination } from "@/types/destination.types";

interface FlightFiltersProps {
  filters: Omit<IFlightsQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IFlightsQueryParams, "page" | "limit">>
  ) => void;
  destinations: IDestination[];
  /** Page actions (Create) rendered inside the toolbar. */
  actions?: React.ReactNode;
}

export function FlightFilters({
  filters,
  onFiltersChange,
  destinations,
  actions,
}: FlightFiltersProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const activeCount = [
    filters.flightClass,
    filters.originId,
    filters.destinationId,
  ].filter(Boolean).length;

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
    <FilterBar
      search={searchInput}
      onSearch={setSearchInput}
      searchPlaceholder="Search by flight number or airline…"
      activeCount={activeCount}
      onClear={clearFilters}
      actions={actions}
    >
      <Select
        value={filters.originId?.toString() || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            originId: value === "all" ? undefined : parseInt(value),
          })
        }
      >
        <SelectTrigger className="w-full lg:w-[160px]">
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

      <Select
        value={filters.destinationId?.toString() || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            destinationId: value === "all" ? undefined : parseInt(value),
          })
        }
      >
        <SelectTrigger className="w-full lg:w-[160px]">
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

      <Select
        value={filters.flightClass || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            flightClass: value === "all" ? undefined : (value as IFlightClass),
          })
        }
      >
        <SelectTrigger className="w-full lg:w-[140px]">
          <SelectValue placeholder="Class" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Classes</SelectItem>
          <SelectItem value="ECONOMY">Economy</SelectItem>
          <SelectItem value="BUSINESS">Business</SelectItem>
          <SelectItem value="FIRST_CLASS">First Class</SelectItem>
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
