// src/components/bookings/table/bookings-data-table.tsx
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
  VisibilityState } from "@tanstack/react-table";
import toast from "react-hot-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteBookingMutation } from "@/redux/bookingApi";
import { createBookingColumns } from "./columns";
import { BookingActionsDropdown } from "./BookingActionsDropdown";
import { TableFilters } from "./TableFilters";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { IBookingsDataTableProps } from "@/types/booking.types";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { roleOf } from "@/utils/roles";
import EmptyState from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Money } from "@/components/ui/Money";
import {
  FilteredEmpty,
  ROW_BADGE,
  RowCard,
  RowCardList,
  SkeletonRowCards,
} from "@/components/ui/table-bits";
import {
  clearAllFiltersPatch,
  hasActiveTableFilters,
  tableEmptyMode,
} from "@/components/ui/table-empty-logic";
import {
  bookingServiceName,
  getPaymentStatusVariant,
  getStatusVariant,
} from "./bookings-table-logic";
import { getPaymentStatusLabel } from "@/components/payments/table/payments-table-logic";

interface BookingsDataTableProps extends IBookingsDataTableProps {
  showFilters?: boolean;
  showActions?: boolean;
  showPagination?: boolean;
  showSelection?: boolean;
  showCustomer?: boolean;
  isRecentsView?: boolean;
}

export function BookingsDataTable({
  data,
  loading = false,
  totalCount = 0,
  page = 1,
  pageSize = 10,
  filters,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onRefresh,
  showFilters = true,
  showActions = true,
  showPagination = true,
  showSelection = true,
  showCustomer,
  isRecentsView = false }: BookingsDataTableProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  // Customer sessions carry no role field; missing role reads as CUSTOMER.
  const userRole = roleOf(user);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] =
    React.useState(false);

  const [deleteBooking] = useDeleteBookingMutation();

  const shouldShowCustomer =
    showCustomer !== undefined ? showCustomer : showFilters;

  const columns = React.useMemo(() => {
    const cols = createBookingColumns(
      showActions,
      shouldShowCustomer,
      userRole
    );
    if (!showSelection) {
      return cols.filter((col) => col.id !== "select");
    }
    return cols;
  }, [showActions, showSelection, shouldShowCustomer, userRole]);

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
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection },
    manualPagination: true,
    manualFiltering: true,
    pageCount: Math.ceil(totalCount / pageSize) });

  const handleDeleteSelected = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error("Please select bookings to delete");
      return;
    }

    setDeleteSelectedDialogOpen(true);
  };

  const handleDeleteSelectedBookings = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedCount = selectedRows.length;

    setDeleteSelectedDialogOpen(false);

    const toastId = toast.loading(
      `Deleting ${selectedCount} bookings..., please wait`
    );

    try {
      const deletePromises = selectedRows.map((row) =>
        deleteBooking(row.original.id).unwrap()
      );
      await Promise.all(deletePromises);
      toast.dismiss(toastId);
      toast.success(`${selectedCount} bookings deleted successfully`);
      setRowSelection({});
      onRefresh?.();
    } catch (error) {
      toast.dismiss(toastId);
      const { message } = extractApiErrorMessage(error);
      toast.error(message);
    }
  };

  const selectedCount = table.getSelectedRowModel().rows.length;
  const hasData = !loading && table.getRowModel().rows?.length > 0;
  const isEmpty = !loading && table.getRowModel().rows?.length === 0;

  // Empty-state semantics (dms/website pattern): no data + no filters means
  // the whole table scaffold gives way to a single EmptyState; an empty
  // FILTERED result keeps the toolbar and offers a clear action.
  const emptyMode = tableEmptyMode(
    loading,
    table.getRowModel().rows?.length ?? 0,
    hasActiveTableFilters(filters)
  );
  const handleClearFilters = () => onFiltersChange(clearAllFiltersPatch(filters));

  // Enhanced empty state for recents view
  if (isRecentsView && isEmpty) {
    return (
      <div className="w-full max-w-full">
        <EmptyState
          className="rounded-lg border border-foreground/15 py-8"
          eyebrow="No activity"
          title="No recent bookings."
          description="This user hasn't made any bookings yet."
        />
      </div>
    );
  }

  if (emptyMode === "no-data") {
    return (
      <div className="w-full max-w-full">
        <EmptyState
          className="rounded-lg border border-foreground/15"
          title="No bookings yet."
          description="Once a trip is booked it will show up here."
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6">
      {showFilters && (
        <TableFilters
          table={table}
          filters={filters}
          onFiltersChange={onFiltersChange}
          totalCount={totalCount}
          onDeleteSelected={handleDeleteSelected}
        />
      )}

      {/* Dual render: row cards below md, the real table from md up. */}
      <div className="rounded-md border overflow-hidden">
        {/* Phones: dense tappable row cards — no side-scroll. */}
        <RowCardList>
          {loading ? (
            <SkeletonRowCards rows={Math.min(pageSize, 8)} />
          ) : hasData ? (
            table.getRowModel().rows.map((row) => {
              const booking = row.original;
              return (
                <RowCard
                  key={row.id}
                  onOpen={() => router.push(`/dashboard/bookings/${booking.id}`)}
                  leading={
                    showSelection ? (
                      <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                      />
                    ) : undefined
                  }
                  action={
                    showActions ? (
                      <BookingActionsDropdown
                        booking={booking}
                        userRole={userRole}
                      />
                    ) : undefined
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {shouldShowCustomer
                        ? booking.customer.name
                        : bookingServiceName(booking)}
                    </span>
                    <span className="flex-none text-sm font-medium">
                      <Money amount={booking.totalPrice} />
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {shouldShowCustomer
                        ? `${bookingServiceName(booking)} · ${format(
                            new Date(booking.bookingDate),
                            "MMM d, yyyy"
                          )}`
                        : `${booking.type} · ${format(
                            new Date(booking.bookingDate),
                            "MMM d, yyyy"
                          )}`}
                    </span>
                    <span className="flex flex-none gap-1">
                      <Badge
                        variant={getStatusVariant(booking.status)}
                        className={ROW_BADGE}
                      >
                        {booking.status}
                      </Badge>
                      {booking.payment && (
                        <Badge
                          variant={getPaymentStatusVariant(
                            booking.payment.status
                          )}
                          className={ROW_BADGE}
                        >
                          {getPaymentStatusLabel(booking.payment.status)}
                        </Badge>
                      )}
                    </span>
                  </div>
                </RowCard>
              );
            })
          ) : (
            <li>
              <FilteredEmpty
                entityLabel="bookings"
                onClear={handleClearFilters}
              />
            </li>
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
                    {showSelection && (
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                    )}
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    {shouldShowCustomer && (
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full max-w-[200px]" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    {showActions && (
                      <TableCell>
                        <Skeleton className="h-8 w-8 rounded" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : hasData ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/50"
                  >
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
                  <TableCell colSpan={columns.length}>
                    <FilteredEmpty
                      entityLabel="bookings"
                      onClear={handleClearFilters}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {showPagination && (
        <DataTablePagination
          table={table}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}

      {showSelection && (
        <ConfirmationDialog
          open={deleteSelectedDialogOpen}
          onOpenChange={setDeleteSelectedDialogOpen}
          title="Delete Selected Bookings"
          description={`Are you sure you want to delete ${selectedCount} selected bookings? This action cannot be undone.`}
          onConfirm={handleDeleteSelectedBookings}
          confirmText="Delete Selected"
          cancelText="Cancel"
          isDestructive={true}
        />
      )}
    </div>
  );
}
