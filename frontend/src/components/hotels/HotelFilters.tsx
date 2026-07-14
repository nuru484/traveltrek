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
import { IHotelQueryParams } from "@/types/hotel.types";
import { useDebounce } from "@/hooks/useDebounce";
import { IDestination } from "@/types/destination.types";

interface HotelFiltersProps {
  filters: Omit<IHotelQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IHotelQueryParams, "page" | "limit">>
  ) => void;
  destinations: IDestination[];
}

export function HotelFilters({
  filters,
  onFiltersChange,
  destinations,
}: HotelFiltersProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const handleDestinationChange = (value: string) => {
    onFiltersChange({
      destinationId: value === "all" ? undefined : parseInt(value),
    });
  };

  const handleStarRatingChange = (value: string) => {
    onFiltersChange({
      minStarRating: value === "all" ? undefined : parseInt(value),
    });
  };

  const handleCityChange = (value: string) => {
    onFiltersChange({
      city: value === "all" ? undefined : value,
    });
  };

  // Get unique cities from destinations
  const uniqueCities = React.useMemo(() => {
    const cities = new Set<string>();
    destinations.forEach((dest) => {
      if (dest.city) cities.add(dest.city);
    });
    return Array.from(cities).sort();
  }, [destinations]);

  const hasFiltersApplied =
    filters.search ||
    filters.destinationId ||
    filters.city ||
    filters.minStarRating;

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
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Bar */}
      <div className="relative w-full lg:max-w-xs">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by hotel name, city, or address..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
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
                {dest.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* City Filter */}
        {uniqueCities.length > 0 && (
          <Select
            value={filters.city || "all"}
            onValueChange={handleCityChange}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
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
        )}

        {/* Star Rating Filter */}
        <Select
          value={filters.minStarRating?.toString() || "all"}
          onValueChange={handleStarRatingChange}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Star Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
            <SelectItem value="4">4+ Stars</SelectItem>
            <SelectItem value="3">3+ Stars</SelectItem>
            <SelectItem value="2">2+ Stars</SelectItem>
            <SelectItem value="1">1+ Stars</SelectItem>
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
          {filters.destinationId && (
            <Badge variant="secondary" className="gap-2">
              Destination:{" "}
              {destinations.find((d) => d.id === filters.destinationId)?.name}
              <button
                onClick={() => onFiltersChange({ destinationId: undefined })}
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
          {filters.minStarRating && (
            <Badge variant="secondary" className="gap-2">
              Rating: {filters.minStarRating}+ Stars
              <button
                onClick={() => onFiltersChange({ minStarRating: undefined })}
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
