// src/components/users/table/UsersDataTable.tsx
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
  VisibilityState,
} from "@tanstack/react-table";
import toast from "react-hot-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteUserMutation,
  useDeleteAllUsersMutation,
} from "@/redux/userApi";
import { createUserColumns } from "./columns";
import { TableFilters } from "./TableFilters";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { IUsersDataTableProps } from "@/types/user.types";

export function UsersDataTable({
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
}: IUsersDataTableProps) {
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

  const [deleteUser] = useDeleteUserMutation();
  const [deleteAllUsers] = useDeleteAllUsersMutation();

  const columns = React.useMemo(() => createUserColumns(), []);

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
      rowSelection,
    },
    manualPagination: true,
    manualFiltering: true,
    pageCount: Math.ceil(totalCount / pageSize),
  });

  const handleDeleteSelected = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error("Please select staff to delete");
      return;
    }

    const selectedCount = selectedRows.length;
    const isAllUsersSelected = selectedCount === totalCount;

    if (isAllUsersSelected) {
      setDeleteAllDialogOpen(true);
    } else {
      setDeleteSelectedDialogOpen(true);
    }
  };

  const handleDeleteSelectedUsers = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedCount = selectedRows.length;

    setDeleteSelectedDialogOpen(false);

    const toastId = toast.loading(
      `Deleting ${selectedCount} users..., please wait`
    );

    try {
      const deletePromises = selectedRows.map((row) =>
        deleteUser(row.original.id).unwrap()
      );
      await Promise.all(deletePromises);
      toast.dismiss(toastId);
      toast.success(`${selectedCount} users deleted successfully`);
      setRowSelection({});
      onRefresh?.();
    } catch (error) {
      toast.dismiss(toastId);
      const { message } = extractApiErrorMessage(error);
      toast.error(message);
    }
  };

  const handleDeleteAllUsers = async () => {
    const toastId = toast.loading("Deleting all users..., please wait");

    try {
      await deleteAllUsers({ confirmDelete: "DELETE_ALL_USERS" }).unwrap();
      toast.dismiss(toastId);
      toast.success("All users deleted successfully");
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

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Filters with integrated actions */}
      <TableFilters
        table={table}
        filters={filters}
        onFiltersChange={onFiltersChange}
        totalCount={totalCount}
        onDeleteSelected={handleDeleteSelected}
      />

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
                    <TableCell>
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full max-w-[300px]" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
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
                        No staff found
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

      {/* Pagination */}
      <DataTablePagination
        table={table}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      {/* Delete Selected Users Dialog */}
      <ConfirmationDialog
        open={deleteSelectedDialogOpen}
        onOpenChange={setDeleteSelectedDialogOpen}
        title="Delete Selected Users"
        description={`Are you sure you want to delete ${selectedCount} selected users? This action cannot be undone.`}
        onConfirm={handleDeleteSelectedUsers}
        confirmText="Delete Selected"
        cancelText="Cancel"
        isDestructive={true}
      />

      {/* Delete All Users Dialog */}
      <ConfirmationDialog
        open={deleteAllDialogOpen}
        onOpenChange={setDeleteAllDialogOpen}
        title="Delete All Users"
        description={`Are you sure you want to delete all ${totalCount} users? This action cannot be undone.`}
        onConfirm={handleDeleteAllUsers}
        confirmText="Delete All Users"
        cancelText="Cancel"
        isDestructive={true}
        requireExactMatch="DELETE_ALL_USERS"
      />
    </div>
  );
}
