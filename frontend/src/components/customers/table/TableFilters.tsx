// src/components/customers/table/TableFilters.tsx
"use client";
import * as React from "react";
import { Table } from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ICustomer, ICustomersQueryParams } from "@/types/customer.types";
import { useDebounce } from "@/hooks/useDebounce";

interface ITableFiltersProps {
  table: Table<ICustomer>;
  filters: Omit<ICustomersQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<ICustomersQueryParams, "page" | "limit">>
  ) => void;
  totalCount: number;
}

export function TableFilters({
  table,
  filters,
  onFiltersChange,
  totalCount,
}: ITableFiltersProps) {
  // Local state for search input
  const [searchInput, setSearchInput] = React.useState(filters.search || "");

  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 500);

  // Update filters when debounced search changes
  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  const hasFiltersApplied = filters.search !== undefined;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {totalCount} total customers
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="w-full min-w-0 md:max-w-sm">
          <Input
            placeholder="Search customers by name, email or phone..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          {hasFiltersApplied && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput("");
                onFiltersChange({ search: undefined });
              }}
              className="whitespace-nowrap"
            >
              Clear filters
            </Button>
          )}

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className="whitespace-nowrap"
              >
                <ChevronDown className="w-4 h-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <div className="p-2">
                <div className="text-sm font-medium mb-2">Toggle columns</div>
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id.replace(/([A-Z])/g, " $1").trim()}
                    </DropdownMenuCheckboxItem>
                  ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active Filters Display */}
      {filters.search && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
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
        </div>
      )}
    </div>
  );
}
