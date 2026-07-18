// src/components/customers/table/TableFilters.tsx
"use client";
import * as React from "react";
import { Table } from "@tanstack/react-table";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnToggleMenu } from "@/components/ui/ColumnToggleMenu";
import { ICustomer, ICustomersQueryParams } from "@/types/customer.types";
import { useDebounce } from "@/hooks/useDebounce";

interface ITableFiltersProps {
  table: Table<ICustomer>;
  filters: Omit<ICustomersQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<ICustomersQueryParams, "page" | "limit">>
  ) => void;
  totalCount: number;
  /** Page actions (e.g. Add Customer) rendered inside the toolbar. */
  actions?: React.ReactNode;
}

export function TableFilters({
  table,
  filters,
  onFiltersChange,
  totalCount,
  actions,
}: ITableFiltersProps) {
  // Local state for search input
  const [searchInput, setSearchInput] = React.useState(filters.search || "");

  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 500);

  // Update filters when debounced search changes
  // Only USER-TYPED input propagates through the debounce; external filter
  // changes (URL/session restore, clear-filters, empty-state clear) must not
  // be echoed back - the echo would reset the page and clobber restored state.
  const typedRef = React.useRef(false);

  // External search changes override the input.
  React.useEffect(() => {
    if ((filters.search || "") !== debouncedSearch) {
      // Synchronizing with an external system (URL/session-restored filter
      // state) - exactly what this input can't derive during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchInput(filters.search || "");
      typedRef.current = false;
    }
    // Sync only when the search filter itself changes externally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  React.useEffect(() => {
    if (!typedRef.current) return;
    if (debouncedSearch !== (filters.search || "")) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {totalCount} total customers
      </div>

      <FilterBar
        search={searchInput}
        onSearch={(value) => {
          typedRef.current = true;
          setSearchInput(value);
        }}
        searchPlaceholder="Search customers by name, email or phone…"
        actionsAlign="left"
        actions={
          <>
            {actions}
            <ColumnToggleMenu table={table} />
          </>
        }
      />
    </div>
  );
}
