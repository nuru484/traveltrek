"use client";
import * as React from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { IBooking, BookingStatus } from "@/types/booking.types";
import {
  useUpdateBookingMutation,
  useDeleteBookingMutation,
} from "@/redux/bookingApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PaymentButton } from "@/components/payments/PaymentButton";

interface BookingActionsDropdownProps {
  booking: IBooking;
  userRole?: "ADMIN" | "AGENT" | "CUSTOMER";
}

export function BookingActionsDropdown({
  booking,
  userRole = "CUSTOMER",
}: BookingActionsDropdownProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const [updateBooking] = useUpdateBookingMutation();
  const [deleteBooking] = useDeleteBookingMutation();

  const handleDeleteBooking = async () => {
    const toastId = toast.loading("Deleting booking...");

    try {
      await deleteBooking(booking.id).unwrap();
      toast.dismiss(toastId);
      toast.success("Booking deleted successfully");
      setDeleteDialogOpen(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message);
      setDeleteDialogOpen(false);
    }
  };

  const handleStatusUpdate = async (newStatus: BookingStatus) => {
    const toastId = toast.loading("Updating status... Please wait");

    try {
      await updateBooking({
        bookingId: booking.id,
        data: { status: newStatus },
      }).unwrap();

      toast.dismiss(toastId);
      toast.success(`Booking status updated to ${newStatus}`);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message);
    }
  };

  const getStatusIcon = (status: BookingStatus) => {
    switch (status) {
      case "PENDING":
        return <AlertCircle className="mr-2 h-4 w-4" />;
      case "CONFIRMED":
        return <CheckCircle className="mr-2 h-4 w-4" />;
      case "CANCELLED":
        return <Trash2 className="mr-2 h-4 w-4" />;
      case "COMPLETED":
        return <Clock className="mr-2 h-4 w-4" />;
    }
  };

  const statusOptions: { value: BookingStatus; label: string }[] = [
    { value: "PENDING", label: "Pending" },
    { value: "CONFIRMED", label: "Confirmed" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "COMPLETED", label: "Completed" },
  ];

  const needsPayment = booking.status === "PENDING" && !booking.payment;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 hover:cursor-pointer">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/bookings/${booking.id}`}
              className="hover:cursor-pointer"
            >
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>

          {userRole === "ADMIN" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:cursor-pointer">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Update Status
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {statusOptions.map((status) => (
                    <DropdownMenuItem
                      key={status.value}
                      className="hover:cursor-pointer"
                      onClick={() => handleStatusUpdate(status.value)}
                      disabled={booking.status === status.value}
                    >
                      {getStatusIcon(status.value)}
                      {status.label}
                      {booking.status === status.value && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          Current
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}

          {needsPayment && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1">
                <PaymentButton
                  bookingId={booking.id}
                  amount={booking.totalPrice}
                  currency="GHS"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 px-2 hover:cursor-pointer"
                />
              </div>
            </>
          )}

          {userRole === "ADMIN" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 hover:cursor-pointer"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Booking
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Booking"
        description={`Are you sure you want to delete booking #${booking.id
          .toString()
          .padStart(6, "0")}? This action cannot be undone.`}
        onConfirm={handleDeleteBooking}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
      />
    </>
  );
}
