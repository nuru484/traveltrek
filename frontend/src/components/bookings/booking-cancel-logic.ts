// src/components/bookings/booking-cancel-logic.ts
//
// Pure visibility rules for the "Cancel booking" action, mirroring the
// backend's POST /bookings/:id/cancel refusals (booking.service.cancelBooking)
// as far as the booking DTO allows:
//
// - already CANCELLED / COMPLETED bookings can't be cancelled;
// - customers may only cancel their OWN bookings (staff may cancel any);
// - a booking whose trip has started can't be cancelled. The DTO only
//   carries a trip start for ROOM bookings (room.startDate — the tour start
//   and flight departure aren't on the wire), so TOUR/FLIGHT bookings show
//   the action and the backend enforces the cutoff.
import type { IBooking } from "@/types/booking.types";

/** The trip-start date the booking DTO exposes (ROOM check-in only). */
export function bookingTripStart(booking: IBooking): string | null {
  return booking.type === "ROOM" ? booking.room?.startDate ?? null : null;
}

export interface CancelActor {
  /** ADMIN/AGENT may cancel any booking; customers only their own. */
  isStaff: boolean;
  /** The customer id of a customer session (unused for staff). */
  userId?: number;
}

/** Whether the cancel action should be offered for this booking. */
export function canCancelBooking(
  booking: IBooking,
  actor: CancelActor,
  now: Date = new Date()
): boolean {
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    return false;
  }
  if (!actor.isStaff && booking.customerId !== actor.userId) {
    return false;
  }
  const tripStart = bookingTripStart(booking);
  if (tripStart && new Date(tripStart).getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/** True when cancelling parks the payment on REFUND_REQUESTED. */
export function cancelRequestsRefund(booking: IBooking): boolean {
  return booking.payment?.status === "COMPLETED";
}

/** The consequence copy for the confirmation dialog. */
export function cancelDialogDescription(booking: IBooking): string {
  const base = `Are you sure you want to cancel booking #${booking.id}? This cannot be undone.`;
  return cancelRequestsRefund(booking)
    ? `${base} Your payment will be marked for refund and our team will process it.`
    : base;
}
