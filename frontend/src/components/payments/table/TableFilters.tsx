// src/components/payments/table/TableFilters.tsx
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

  const getStatusFilterValue = () => {
    if (filters.status === "PENDING") return "pending";
    if (filters.status === "COMPLETED") return "completed";
    if (filters.status === "FAILED") return "failed";
    if (filters.status === "REFUNDED") return "refunded";
    if (filters.status === "REFUND_REQUESTED") return "refund_requested";
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
    else if (value === "refund_requested") status = "REFUND_REQUESTED";
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

  const activeCount = [filters.status, filters.paymentMethod].filter(
    Boolean
  ).length;

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
          {totalCount} total payments
        </div>
      )}

      <FilterBar
        search={searchInput}
        onSearch={(value) => {
          typedRef.current = true;
          setSearchInput(value);
        }}
        searchPlaceholder="Search by name, email or reference…"
        activeCount={activeCount}
        onClear={clearFilters}
        actions={<ColumnToggleMenu table={table} />}
      >
        <Select
          value={getStatusFilterValue()}
          onValueChange={handleStatusFilterChange}
        >
          <SelectTrigger className="w-full lg:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="refund_requested">Refund Requested</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={getPaymentMethodFilterValue()}
          onValueChange={handlePaymentMethodFilterChange}
        >
          <SelectTrigger className="w-full lg:w-[160px]">
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
      </FilterBar>
    </div>
  );
}
