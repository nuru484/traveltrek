// src/components/users/table/users-data-table.tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useDeleteUserMutation } from "@/redux/userApi";
import { createUserColumns } from "./columns";
import { UserActionsDropdown } from "./UserActionsDropdown";
import { TableFilters } from "./TableFilters";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { IUsersDataTableProps } from "@/types/user.types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ROW_BADGE, RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";

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
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] =
    React.useState(false);

  const [deleteUser] = useDeleteUserMutation();

  const columns = React.useMemo(() => createUserColumns(), []);

  const table = useDataTable({ columns, data, pageSize, totalCount });

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
      table.resetRowSelection();
      onRefresh?.();
    } catch (error) {
      toast.dismiss(toastId);
      const { message } = extractApiErrorMessage(error);
      toast.error(message);
    }
  };

  const selectedCount = table.getSelectedRowModel().rows.length;

  return (
    <>
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
        entityLabel="staff accounts"
        noData={{
          title: "No staff accounts yet.",
          description: "Add your first staff account to get started.",
        }}
        toolbar={
          <TableFilters
            table={table}
            filters={filters}
            onFiltersChange={onFiltersChange}
            totalCount={totalCount}
            onDeleteSelected={handleDeleteSelected}
            actions={toolbarActions}
          />
        }
        renderRowCard={(row) => {
          const staff = row.original;
          return (
            <RowCard
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
        }}
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
    </>
  );
}
