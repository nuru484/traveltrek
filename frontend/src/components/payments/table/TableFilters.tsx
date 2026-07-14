// src/components/payments/table/TableFilters.tsx
"use client";
import * as React from "react";
import { Table } from "@tanstack/react-table";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { IPayment, IPaymentsQueryParams } from "@/types/payment.types";
import { useDebounce } from "@/hooks/useDebounce";

interface ITableFiltersProps {
  table: Table<IPayment>;
  filters: Omit<IPaymentsQueryParams, "page" | "limit">;
  onFiltersChange: (
    filters: Partial<Omit<IPaymentsQueryParams, "page" | "limit">>
  ) => void;
  totalCount: number;
  onDeleteSelected: () => void;
}

export function TableFilters({
  table,
  filters,
  onFiltersChange,
  totalCount,
  onDeleteSelected,
}: ITableFiltersProps) {
  const selectedCount = table.getSelectedRowModel().rows.length;
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

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

  const getStatusFilterValue = () => {
    if (filters.status === "PENDING") return "pending";
    if (filters.status === "COMPLETED") return "completed";
    if (filters.status === "FAILED") return "failed";
    if (filters.status === "REFUNDED") return "refunded";
    return "all";
  };

  const getPaymentMethodFilterValue = () => {
    if (filters.paymentMethod === "CREDIT_CARD") return "credit_card";
    if (filters.paymentMethod === "DEBIT_CARD") return "debit_card";
    if (filters.paymentMethod === "MOBILE_MONEY") return "mobile_money";
    if (filters.paymentMethod === "BANK_TRANSFER") return "bank_transfer";
    return "all";
  };

  const handleStatusFilterChange = (value: string) => {
    let status: IPayment["status"] | undefined;
    if (value === "pending") status = "PENDING";
    else if (value === "completed") status = "COMPLETED";
    else if (value === "failed") status = "FAILED";
    else if (value === "refunded") status = "REFUNDED";
    else status = undefined;

    onFiltersChange({ status });
  };

  const handlePaymentMethodFilterChange = (value: string) => {
    let paymentMethod: IPaymentsQueryParams["paymentMethod"] | undefined;
    if (value === "credit_card") paymentMethod = "CREDIT_CARD";
    else if (value === "debit_card") paymentMethod = "DEBIT_CARD";
    else if (value === "mobile_money") paymentMethod = "MOBILE_MONEY";
    else if (value === "bank_transfer") paymentMethod = "BANK_TRANSFER";
    else paymentMethod = undefined;

    onFiltersChange({ paymentMethod });
  };

  const hasFiltersApplied =
    filters.status !== undefined ||
    filters.paymentMethod !== undefined ||
    filters.search !== undefined;

  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange({
      search: undefined,
      status: undefined,
      paymentMethod: undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Selection Info & Delete Action */}
        <div className="flex items-center gap-3 order-2 lg:order-1">
          {selectedCount > 0 ? (
            <div className="flex items-center gap-3 bg-muted/50 px-3 py-2 rounded-lg border">
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
                {isAllSelected ? "Delete All" : "Delete Selected"}
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {totalCount} total payments
            </div>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col xl:flex-row gap-4">
        {/* Search Input */}
        <div className="w-full min-w-0 md:max-w-sm">
          <Input
            placeholder="Search payments by user name, email, or transaction reference..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Status Filter */}
          <Select
            value={getStatusFilterValue()}
            onValueChange={handleStatusFilterChange}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Method Filter */}
          <Select
            value={getPaymentMethodFilterValue()}
            onValueChange={handlePaymentMethodFilterChange}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
              <SelectItem value="debit_card">Debit Card</SelectItem>
              <SelectItem value="mobile_money">Mobile Money</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasFiltersApplied && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
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
      {hasFiltersApplied && (
        <div className="flex flex-wrap items-center gap-2">
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
          {filters.status !== undefined && (
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
          {filters.paymentMethod !== undefined && (
            <Badge variant="secondary" className="gap-2">
              Method: {filters.paymentMethod.replace("_", " ")}
              <button
                onClick={() => onFiltersChange({ paymentMethod: undefined })}
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