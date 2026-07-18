// src/components/payments/table/payments-data-table.tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useDeletePaymentMutation } from "@/redux/paymentApi";
import { createPaymentColumns } from "./columns";
import { PaymentActionsDropdown } from "./PaymentActionsDropdown";
import { TableFilters } from "./TableFilters";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { IPaymentsDataTableProps } from "@/types/payment.types";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { roleOf } from "@/utils/roles";
import EmptyState from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Money } from "@/components/ui/Money";
import { ROW_BADGE, RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import {
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getStatusVariant,
} from "./payments-table-logic";

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
  isRecentsView = false,
}: PaymentsDataTableProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  // Customer sessions carry no role field; missing role reads as CUSTOMER.
  const userRole = roleOf(user);
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] =
    React.useState(false);

  const [deletePayment] = useDeletePaymentMutation();

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

  const table = useDataTable({ columns, data, pageSize, totalCount });

  const handleDeleteSelected = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error("Please select payments to delete");
      return;
    }

    setDeleteSelectedDialogOpen(true);
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
        entityLabel="payments"
        noData={{
          title: "No payments yet.",
          description: "Payments show up here once a booking is paid for.",
        }}
        emptyOverride={
          isRecentsView ? (
            <EmptyState
              className="rounded-lg border border-foreground/15 py-8"
              eyebrow="No activity"
              title="No recent payments."
              description="This user hasn't made any payments yet."
            />
          ) : undefined
        }
        toolbar={
          showFilters ? (
            <TableFilters
              table={table}
              filters={filters}
              onFiltersChange={onFiltersChange}
              totalCount={totalCount}
              onDeleteSelected={handleDeleteSelected}
            />
          ) : undefined
        }
        showPagination={showPagination}
        renderRowCard={(row) => {
          const payment = row.original;
          const paymentDate = payment.paymentDate ?? payment.createdAt;
          return (
            <RowCard
              onOpen={() => router.push(`/dashboard/payments/${payment.id}`)}
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
                  <PaymentActionsDropdown
                    payment={payment}
                    userRole={userRole}
                  />
                ) : undefined
              }
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {shouldShowUser
                    ? payment.customer.name
                    : payment.transactionReference}
                </span>
                <span className="flex-none text-sm font-medium">
                  <Money amount={payment.amount} />
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {shouldShowUser
                    ? payment.transactionReference
                    : getPaymentMethodLabel(payment.paymentMethod)}
                  {paymentDate
                    ? ` · ${format(new Date(paymentDate), "MMM d, yyyy")}`
                    : ""}
                </span>
                <span className="flex flex-none gap-1">
                  <Badge
                    variant={getStatusVariant(payment.status)}
                    className={ROW_BADGE}
                  >
                    {getPaymentStatusLabel(payment.status)}
                  </Badge>
                </span>
              </div>
            </RowCard>
          );
        }}
      />

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
    </>
  );
}
