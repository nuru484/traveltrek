// src/components/customers/table/customers-data-table.tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { isAdmin as isAdminUser } from "@/utils/roles";
import { createCustomerColumns } from "./columns";
import { CustomerActionsDropdown } from "./CustomerActionsDropdown";
import { TableFilters } from "./TableFilters";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { ICustomersDataTableProps } from "@/types/customer.types";
import {
  RowCard,
  RowCardEmpty,
  RowCardList,
  SkeletonRowCards,
} from "@/components/ui/table-bits";

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
}: ICustomersDataTableProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = isAdminUser(user);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const columns = React.useMemo(() => createCustomerColumns(isAdmin), [
    isAdmin,
  ]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    manualPagination: true,
    manualFiltering: true,
    pageCount: Math.ceil(totalCount / pageSize),
  });

  return (
    <div className="w-full max-w-full space-y-6">
      <TableFilters
        table={table}
        filters={filters}
        onFiltersChange={onFiltersChange}
        totalCount={totalCount}
      />

      {/* Dual render: row cards below md, the real table from md up. */}
      <div className="rounded-md border overflow-hidden">
        {/* Phones: dense tappable row cards — no side-scroll. */}
        <RowCardList>
          {loading ? (
            <SkeletonRowCards rows={Math.min(pageSize, 8)} />
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              const customer = row.original;
              return (
                <RowCard
                  key={row.id}
                  onOpen={() =>
                    router.push(`/dashboard/customers/${customer.id}`)
                  }
                  action={
                    <CustomerActionsDropdown
                      customer={customer}
                      isAdmin={isAdmin}
                    />
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {customer.name}
                    </span>
                    <span className="flex-none text-xs text-muted-foreground">
                      {customer.createdAt
                        ? format(new Date(customer.createdAt), "MMM d, yyyy")
                        : "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {customer.email || customer.phone || "No contact"}
                    </span>
                  </div>
                </RowCard>
              );
            })
          ) : (
            <RowCardEmpty
              title="No customers found"
              hint="Try adjusting your search criteria"
            />
          )}
        </RowCardList>

        {/* ≥md: the full table. */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell>
                      <Skeleton className="h-10 w-10 rounded-md" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full max-w-[300px]" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8 rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/50">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="text-muted-foreground">
                        No customers found
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Try adjusting your search criteria
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <DataTablePagination
        table={table}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
