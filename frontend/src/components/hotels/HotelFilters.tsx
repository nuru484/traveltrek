// src/components/hotels/HotelFilters.tsx
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
import { IHotelQueryParams } from "@/types/hotel.types";
import { useDebounce } from "@/hooks/useDebounce";
import { IDestination } from "@/types/destination.types";

interface HotelFiltersProps {
  filters: Omit<IHotelQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IHotelQueryParams, "page" | "limit">>
  ) => void;
  destinations: IDestination[];
  /** Page actions (Create / Delete all) rendered inside the toolbar. */
  actions?: React.ReactNode;
}

export function HotelFilters({
  filters,
  onFiltersChange,
  destinations,
  actions,
}: HotelFiltersProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const uniqueCities = React.useMemo(() => {
    const cities = new Set<string>();
    destinations.forEach((dest) => {
      if (dest.city) cities.add(dest.city);
    });
    return Array.from(cities).sort();
  }, [destinations]);

  const activeCount = [
    filters.destinationId,
    filters.city,
    filters.minStarRating,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange({
      search: undefined,
      destinationId: undefined,
      city: undefined,
      minStarRating: undefined,
      country: undefined,
    });
  };

  return (
    <FilterBar
      search={searchInput}
      onSearch={setSearchInput}
      searchPlaceholder="Search by hotel name, city, or address…"
      activeCount={activeCount}
      onClear={clearFilters}
      actions={actions}
    >
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
              {dest.name}
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
          {uniqueCities.map((city) => (
            <SelectItem key={city} value={city}>
              {city}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.minStarRating?.toString() || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            minStarRating: value === "all" ? undefined : parseInt(value),
          })
        }
      >
        <SelectTrigger className="w-full lg:w-[140px]">
          <SelectValue placeholder="Star Rating" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Ratings</SelectItem>
          <SelectItem value="5">5 Stars</SelectItem>
          <SelectItem value="4">4+ Stars</SelectItem>
          <SelectItem value="3">3+ Stars</SelectItem>
          <SelectItem value="2">2+ Stars</SelectItem>
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
