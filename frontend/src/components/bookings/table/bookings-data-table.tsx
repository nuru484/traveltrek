// src/components/bookings/table/bookings-data-table.tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useDeleteBookingMutation } from "@/redux/bookingApi";
import { createBookingColumns } from "./columns";
import { BookingActionsDropdown } from "./BookingActionsDropdown";
import { TableFilters } from "./TableFilters";
import { DataTable, useDataTable } from "@/components/ui/data-table";
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
import { ROW_BADGE, RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
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
  isRecentsView = false,
}: BookingsDataTableProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  // Customer sessions carry no role field; missing role reads as CUSTOMER.
  const userRole = roleOf(user);
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

  const table = useDataTable({ columns, data, pageSize, totalCount });

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
        entityLabel="bookings"
        noData={{
          title: "No bookings yet.",
          description: "Once a trip is booked it will show up here.",
        }}
        emptyOverride={
          isRecentsView ? (
            <EmptyState
              className="rounded-lg border border-foreground/15 py-8"
              eyebrow="No activity"
              title="No recent bookings."
              description="This user hasn't made any bookings yet."
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
          const booking = row.original;
          return (
            <RowCard
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
                      variant={getPaymentStatusVariant(booking.payment.status)}
                      className={ROW_BADGE}
                    >
                      {getPaymentStatusLabel(booking.payment.status)}
                    </Badge>
                  )}
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
          title="Delete Selected Bookings"
          description={`Are you sure you want to delete ${selectedCount} selected bookings? This action cannot be undone.`}
          onConfirm={handleDeleteSelectedBookings}
          confirmText="Delete Selected"
          cancelText="Cancel"
          isDestructive={true}
        />
      )}
    </>
  );
}
