// src/components/destinations/DestinationFilters.tsx
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
import { IDestinationQueryParams } from "@/types/destination.types";
import { useDebounce } from "@/hooks/useDebounce";

interface DestinationFiltersProps {
  filters: Omit<IDestinationQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IDestinationQueryParams, "page" | "limit">>
  ) => void;
  countries: string[];
  cities: string[];
}

export function DestinationFilters({
  filters,
  onFiltersChange,
  countries,
  cities,
}: DestinationFiltersProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const handleCountryChange = (value: string) => {
    onFiltersChange({
      country: value === "all" ? undefined : value,
    });
  };

  const handleCityChange = (value: string) => {
    onFiltersChange({
      city: value === "all" ? undefined : value,
    });
  };

  const hasFiltersApplied = filters.search || filters.country || filters.city;

  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange({
      search: undefined,
      country: undefined,
      city: undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Bar */}
      <div className="relative w-full lg:max-w-xs">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by destination name or description..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Country Filter */}
        {countries.length > 0 && (
          <Select
            value={filters.country || "all"}
            onValueChange={handleCountryChange}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
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
        )}

        {/* City Filter */}
        {cities.length > 0 && (
          <Select
            value={filters.city || "all"}
            onValueChange={handleCityChange}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
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
        )}

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
          {filters.country && (
            <Badge variant="secondary" className="gap-2">
              Country: {filters.country}
              <button
                onClick={() => onFiltersChange({ country: undefined })}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                ×
              </button>
            </Badge>
          )}
          {filters.city && (
            <Badge variant="secondary" className="gap-2">
              City: {filters.city}
              <button
                onClick={() => onFiltersChange({ city: undefined })}
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
