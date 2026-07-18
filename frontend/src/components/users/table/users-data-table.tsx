// src/components/users/table/users-data-table.tsx
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
import { useDeleteUserMutation } from "@/redux/userApi";
import { createUserColumns } from "./columns";
import { UserActionsDropdown } from "./UserActionsDropdown";
import { TableFilters } from "./TableFilters";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { IUsersDataTableProps } from "@/types/user.types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import EmptyState from "@/components/ui/EmptyState";

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
  toolbarActions,
}: IUsersDataTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] =
    React.useState(false);

  const [deleteUser] = useDeleteUserMutation();

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

  // Empty-state semantics (dms/website pattern): no data + no filters means
  // the whole table scaffold gives way to a single EmptyState; an empty
  // FILTERED result keeps the toolbar and offers a clear action.
  const emptyMode = tableEmptyMode(
    loading,
    table.getRowModel().rows?.length ?? 0,
    hasActiveTableFilters(filters)
  );
  const handleClearFilters = () => onFiltersChange(clearAllFiltersPatch(filters));

  const handleDeleteSelected = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error("Please select staff to delete");
      return;
    }

    setDeleteSelectedDialogOpen(true);
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

  const selectedCount = table.getSelectedRowModel().rows.length;

  if (emptyMode === "no-data") {
    return (
      <div className="w-full max-w-full">
        <EmptyState
          className="rounded-lg border border-foreground/15"
          title="No staff accounts yet."
          description="Add your first staff account to get started."
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Filters with integrated actions */}
      <TableFilters
        table={table}
        filters={filters}
        onFiltersChange={onFiltersChange}
        totalCount={totalCount}
        onDeleteSelected={handleDeleteSelected}
        actions={toolbarActions}
      />

      {/* Dual render: row cards below md, the real table from md up. */}
      <div className="rounded-md border overflow-hidden">
        {/* Phones: dense tappable row cards - no side-scroll. */}
        <RowCardList>
          {loading ? (
            <SkeletonRowCards rows={Math.min(pageSize, 8)} />
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              const staff = row.original;
              return (
                <RowCard
                  key={row.id}
                  onOpen={() =>
                    router.push(`/dashboard/users/${staff.id}/user-profile`)
                  }
                  leading={
                    <Checkbox
                      checked={row.getIsSelected()}
                      onCheckedChange={(value) => row.toggleSelected(!!value)}
                      aria-label="Select row"
                    />
                  }
                  action={<UserActionsDropdown user={staff} />}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {staff.name}
                    </span>
                    <span className="flex flex-none gap-1">
                      <Badge
                        variant={staff.role === "ADMIN" ? "default" : "secondary"}
                        className={ROW_BADGE}
                      >
                        {staff.role}
                      </Badge>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {staff.email || staff.phone || "No contact"}
                    </span>
                    <span className="flex-none text-xs text-muted-foreground">
                      {staff.createdAt
                        ? format(new Date(staff.createdAt), "MMM d, yyyy")
                        : "-"}
                    </span>
                  </div>
                </RowCard>
              );
            })
          ) : (
            <li>
              <FilteredEmpty
                entityLabel="staff accounts"
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
                  <TableCell colSpan={columns.length}>
                    <FilteredEmpty
                      entityLabel="staff accounts"
                      onClear={handleClearFilters}
                    />
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
    </div>
  );
}
