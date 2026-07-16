// src/components/bookings/CancelBookingButton.tsx
//
// "Cancel booking" for the booking detail page — customers on their own
// PENDING/CONFIRMED bookings, staff on any. Confirmation explains the
// consequences (a paid booking's payment is marked for refund); the backend
// owns the final rules and its message is surfaced verbatim.
"use client";
import * as React from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useCancelBookingMutation } from "@/redux/bookingApi";
import { RootState } from "@/redux/store";
import { isStaff } from "@/utils/roles";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import type { IBooking } from "@/types/booking.types";
import {
  canCancelBooking,
  cancelDialogDescription,
} from "./booking-cancel-logic";

export function CancelBookingButton({ booking }: { booking: IBooking }) {
  const user = useSelector((state: RootState) => state.auth.user);
  const staff = isStaff(user);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [cancelBooking, { isLoading }] = useCancelBookingMutation();

  if (!canCancelBooking(booking, { isStaff: staff, userId: user?.id })) {
    return null;
  }

  const handleCancel = async () => {
    try {
      const result = await cancelBooking(booking.id).unwrap();
      toast.success(result.message);
      setDialogOpen(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.error(message || "Could not cancel the booking");
      setDialogOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        className="cursor-pointer border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <XCircle className="mr-2 h-4 w-4" />
        Cancel booking
      </Button>

      <ConfirmationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Cancel Booking"
        description={cancelDialogDescription(booking)}
        onConfirm={handleCancel}
        confirmText="Cancel booking"
        cancelText="Keep booking"
        isDestructive
      />
    </>
  );
}
