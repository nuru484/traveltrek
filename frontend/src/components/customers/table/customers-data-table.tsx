// src/components/customers/table/customers-data-table.tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { isAdmin as isAdminUser } from "@/utils/roles";
import { createCustomerColumns } from "./columns";
import { CustomerActionsDropdown } from "./CustomerActionsDropdown";
import { TableFilters } from "./TableFilters";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { ICustomersDataTableProps } from "@/types/customer.types";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";

export function CustomersDataTable({
  data,
  loading = false,
  totalCount = 0,
  page = 1,
  pageSize = 10,
  filters,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  toolbarActions,
}: ICustomersDataTableProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = isAdminUser(user);

  const columns = React.useMemo(() => createCustomerColumns(isAdmin), [
    isAdmin,
  ]);

  const table = useDataTable({ columns, data, pageSize, totalCount });

  return (
    <DataTable
      table={table}
      loading={loading}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      filters={filters}
      onClearFilters={() => onFiltersChange(clearAllFiltersPatch(filters))}
      entityLabel="customers"
      noData={{
        title: "No customers yet.",
        description: "Add your first customer and their bookings will follow.",
      }}
      toolbar={
        <TableFilters
          table={table}
          filters={filters}
          onFiltersChange={onFiltersChange}
          totalCount={totalCount}
          actions={toolbarActions}
        />
      }
      renderRowCard={(row) => {
        const customer = row.original;
        return (
          <RowCard
            onOpen={() => router.push(`/dashboard/customers/${customer.id}`)}
            action={
              <CustomerActionsDropdown customer={customer} isAdmin={isAdmin} />
            }
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-foreground">
                {customer.name}
              </span>
              <span className="flex-none text-xs text-muted-foreground">
                {customer.createdAt
                  ? format(new Date(customer.createdAt), "MMM d, yyyy")
                  : "-"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {customer.email || customer.phone || "No contact"}
              </span>
            </div>
          </RowCard>
        );
      }}
    />
  );
}
