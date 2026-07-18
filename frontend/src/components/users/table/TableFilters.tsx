// src/components/users/table/TableFilters.tsx
"use client";
import * as React from "react";
import { Table } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnToggleMenu } from "@/components/ui/ColumnToggleMenu";
import { IUser, IUsersQueryParams, StaffRole } from "@/types/user.types";
import { useDebounce } from "@/hooks/useDebounce";

interface ITableFiltersProps {
  table: Table<IUser>;
  filters: Omit<IUsersQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IUsersQueryParams, "page" | "limit">>
  ) => void;
  totalCount: number;
  onDeleteSelected: () => void;
  /** Page actions (e.g. Add Staff) rendered inside the toolbar. */
  actions?: React.ReactNode;
}

export function TableFilters({
  table,
  filters,
  onFiltersChange,
  totalCount,
  onDeleteSelected,
  actions,
}: ITableFiltersProps) {
  const selectedCount = table.getSelectedRowModel().rows.length;
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

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

  // Convert filter values to display values
  const getRoleFilterValue = () => {
    if (filters.role === "ADMIN") return "admin";
    if (filters.role === "AGENT") return "agent";
    return "all";
  };

  const handleRoleFilterChange = (value: string) => {
    let role: StaffRole | undefined;
    if (value === "admin") role = "ADMIN";
    else if (value === "agent") role = "AGENT";
    else role = undefined;

    onFiltersChange({ role });
  };

  const activeCount = filters.role !== undefined ? 1 : 0;

  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange({
      search: undefined,
      role: undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Selection Info & Delete Action */}
      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3 bg-muted/50 px-3 py-2 rounded-lg border w-fit">
          <Badge variant="secondary" className="font-medium">
            {selectedCount} selected {isAllSelected && "(All)"}
          </Badge>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
            className="h-8 hover:cursor-pointer"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {totalCount} total staff
        </div>
      )}

      <FilterBar
        search={searchInput}
        onSearch={(value) => {
          typedRef.current = true;
          setSearchInput(value);
        }}
        searchPlaceholder="Search staff by name or email…"
        activeCount={activeCount}
        onClear={clearFilters}
        actions={
          <>
            {actions}
            <ColumnToggleMenu table={table} />
          </>
        }
      >
        <Select
          value={getRoleFilterValue()}
          onValueChange={handleRoleFilterChange}
        >
          <SelectTrigger className="w-full lg:w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>
    </div>
  );
}
