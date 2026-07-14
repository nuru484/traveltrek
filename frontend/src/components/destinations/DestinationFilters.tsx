// src/components/destinations/DestinationFilters.tsx
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
import { IDestinationQueryParams } from "@/types/destination.types";
import { useDebounce } from "@/hooks/useDebounce";

interface DestinationFiltersProps {
  filters: Omit<IDestinationQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IDestinationQueryParams, "page" | "limit">>
  ) => void;
  countries: string[];
  cities: string[];
  /** Page actions (Create / Delete all) rendered inside the toolbar. */
  actions?: React.ReactNode;
}

export function DestinationFilters({
  filters,
  onFiltersChange,
  countries,
  cities,
  actions,
}: DestinationFiltersProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const activeCount = [filters.country, filters.city].filter(Boolean).length;

  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange({
      search: undefined,
      country: undefined,
      city: undefined,
    });
  };

  return (
    <FilterBar
      search={searchInput}
      onSearch={setSearchInput}
      searchPlaceholder="Search by destination name or description…"
      activeCount={activeCount}
      onClear={clearFilters}
      actions={actions}
    >
      <Select
        value={filters.country || "all"}
        onValueChange={(value) =>
          onFiltersChange({ country: value === "all" ? undefined : value })
        }
      >
        <SelectTrigger className="w-full lg:w-[160px]">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Countries</SelectItem>
          {countries.map((country) => (
            <SelectItem key={country} value={country}>
              {country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.city || "all"}
        onValueChange={(value) =>
          onFiltersChange({ city: value === "all" ? undefined : value })
        }
      >
        <SelectTrigger className="w-full lg:w-[140px]">
          <SelectValue placeholder="City" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Cities</SelectItem>
          {cities.map((city) => (
            <SelectItem key={city} value={city}>
              {city}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
