// src/components/payments/table/PaymentsDataTable.tsx
"use client";
import * as React from "react";
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
import {
  useDeletePaymentMutation,
  useDeleteAllPaymentsMutation } from "@/redux/paymentApi";
import { createPaymentColumns } from "./columns";
import { TableFilters } from "./TableFilters";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { IPaymentsDataTableProps } from "@/types/payment.types";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { roleOf } from "@/utils/roles";
import EmptyState from "@/components/ui/EmptyState";

interface PaymentsDataTableProps extends IPaymentsDataTableProps {
  showFilters?: boolean;
  showActions?: boolean;
  showPagination?: boolean;
  showSelection?: boolean;
  showUser?: boolean;
  showBooking?: boolean;
  isRecentsView?: boolean;
}

export function PaymentsDataTable({
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
  showUser,
  showBooking,
  isRecentsView = false }: PaymentsDataTableProps) {
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
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = React.useState(false);

  const [deletePayment] = useDeletePaymentMutation();
  const [deleteAllPayments] = useDeleteAllPaymentsMutation();

  const shouldShowUser = showUser !== undefined ? showUser : showFilters;
  const shouldShowBooking =
    showBooking !== undefined ? showBooking : showFilters;

  const columns = React.useMemo(() => {
    const cols = createPaymentColumns(
      showActions,
      shouldShowUser,
      shouldShowBooking,
      userRole
    );
    if (!showSelection) {
      return cols.filter((col) => col.id !== "select");
    }
    return cols;
  }, [showActions, showSelection, shouldShowUser, shouldShowBooking, userRole]);

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
      toast.error("Please select payments to delete");
      return;
    }

    const selectedCount = selectedRows.length;
    const isAllPaymentsSelected = selectedCount === totalCount;

    if (isAllPaymentsSelected) {
      setDeleteAllDialogOpen(true);
    } else {
      setDeleteSelectedDialogOpen(true);
    }
  };

  const handleDeleteSelectedPayments = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedCount = selectedRows.length;

    setDeleteSelectedDialogOpen(false);

    const toastId = toast.loading(
      `Deleting ${selectedCount} payments..., please wait`
    );

    try {
      const deletePromises = selectedRows.map((row) =>
        deletePayment(row.original.id).unwrap()
      );
      await Promise.all(deletePromises);
      toast.dismiss(toastId);
      toast.success(`${selectedCount} payments deleted successfully`);
      setRowSelection({});
      onRefresh?.();
    } catch (error) {
      toast.dismiss(toastId);
      const { message } = extractApiErrorMessage(error);
      toast.error(message);
    }
  };

  const handleDeleteAllPayments = async () => {
    const toastId = toast.loading("Deleting all payments..., please wait");

    try {
      await deleteAllPayments().unwrap();
      toast.dismiss(toastId);
      toast.success("All payments deleted successfully");
      setDeleteAllDialogOpen(false);
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

  // Enhanced empty state for recents view
  if (isRecentsView && isEmpty) {
    return (
      <div className="w-full max-w-full">
        <EmptyState
          className="rounded-lg border border-foreground/15 py-8"
          eyebrow="No activity"
          title="No recent payments."
          description="This user hasn't made any payments yet."
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

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
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
                      <Skeleton className="h-4 w-32 font-mono" />
                    </TableCell>
                    {shouldShowUser && (
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full max-w-[200px]" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </TableCell>
                    )}
                    {shouldShowBooking && (
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
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
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="text-muted-foreground">
                        No payments found
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Try adjusting your search or filter criteria
                      </div>
                    </div>
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
          title="Delete Selected Payments"
          description={`Are you sure you want to delete ${selectedCount} selected payments? This action cannot be undone.`}
          onConfirm={handleDeleteSelectedPayments}
          confirmText="Delete Selected"
          cancelText="Cancel"
          isDestructive={true}
        />
      )}

      {showSelection && (
        <ConfirmationDialog
          open={deleteAllDialogOpen}
          onOpenChange={setDeleteAllDialogOpen}
          title="Delete All Payments"
          description={`Are you sure you want to delete all ${totalCount} payments? This action cannot be undone.`}
          onConfirm={handleDeleteAllPayments}
          confirmText="Delete All Payments"
          cancelText="Cancel"
          isDestructive={true}
          requireExactMatch="DELETE_ALL_PAYMENTS"
        />
      )}
    </div>
  );
}
