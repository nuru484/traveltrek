// test/unit/booking-cancel-logic.test.ts
//
// Visibility rules for the "Cancel booking" action — mirrors the backend's
// POST /bookings/:id/cancel refusals as far as the booking DTO allows.
import { describe, expect, it } from "vitest";
import type {
  IBooking,
  IRoomBooking,
  ITourBooking,
} from "@/types/booking.types";
import {
  bookingTripStart,
  canCancelBooking,
  cancelDialogDescription,
  cancelRequestsRefund,
} from "@/components/bookings/booking-cancel-logic";

const NOW = new Date("2026-07-16T12:00:00Z");

const tourBooking = (overrides: Partial<ITourBooking> = {}): IBooking =>
  ({
    id: 7,
    customerId: 42,
    customer: { id: 42, name: "Ama", email: "ama@example.com" },
    createdBy: null,
    numberOfGuests: 2,
    specialRequests: null,
    paymentDeadline: "2026-07-20T00:00:00Z",
    payment: null,
    status: "PENDING",
    totalPrice: 150000,
    bookingDate: "2026-07-10T00:00:00Z",
    createdAt: "2026-07-10T00:00:00Z",
    updatedAt: "2026-07-10T00:00:00Z",
    type: "TOUR",
    tour: {
      id: 1,
      name: "Cape Coast",
      description: null,
      destination: { id: 1, name: "Cape Coast", city: null, country: "Ghana" },
    },
    room: null,
    flight: null,
    ...overrides,
  } as IBooking);

const roomBooking = (startDate: string): IBooking => {
  const base = tourBooking() as unknown as IRoomBooking;
  return {
    ...base,
    type: "ROOM",
    tour: null,
    room: {
      id: 3,
      roomType: "Deluxe",
      description: null,
      numberOfRooms: 1,
      numberOfNights: 2,
      startDate,
      endDate: "2026-08-03T00:00:00Z",
      hotel: {
        id: 1,
        name: "Hotel",
        description: null,
        destination: { id: 1, city: "Accra", country: "Ghana", name: "Accra" },
      },
    },
  } as IBooking;
};

describe("canCancelBooking", () => {
  it("allows a customer to cancel their own PENDING booking", () => {
    expect(
      canCancelBooking(tourBooking(), { isStaff: false, userId: 42 }, NOW)
    ).toBe(true);
  });

  it("allows CONFIRMED, refuses CANCELLED and COMPLETED (terminal)", () => {
    expect(
      canCancelBooking(
        tourBooking({ status: "CONFIRMED" }),
        { isStaff: false, userId: 42 },
        NOW
      )
    ).toBe(true);
    expect(
      canCancelBooking(
        tourBooking({ status: "CANCELLED" }),
        { isStaff: false, userId: 42 },
        NOW
      )
    ).toBe(false);
    expect(
      canCancelBooking(
        tourBooking({ status: "COMPLETED" }),
        { isStaff: false, userId: 42 },
        NOW
      )
    ).toBe(false);
  });

  it("refuses another customer's booking, but staff may cancel any", () => {
    expect(
      canCancelBooking(tourBooking(), { isStaff: false, userId: 99 }, NOW)
    ).toBe(false);
    expect(canCancelBooking(tourBooking(), { isStaff: true }, NOW)).toBe(true);
  });

  it("refuses a room booking whose check-in has passed (trip started)", () => {
    expect(
      canCancelBooking(
        roomBooking("2026-07-01T00:00:00Z"),
        { isStaff: false, userId: 42 },
        NOW
      )
    ).toBe(false);
    expect(
      canCancelBooking(
        roomBooking("2026-08-01T00:00:00Z"),
        { isStaff: false, userId: 42 },
        NOW
      )
    ).toBe(true);
  });

  it("shows the action for tour/flight bookings (start not on the wire)", () => {
    // The DTO carries no tour start / flight departure; the backend enforces
    // the cutoff and the UI surfaces its 400 message.
    expect(bookingTripStart(tourBooking())).toBeNull();
    expect(
      canCancelBooking(tourBooking(), { isStaff: false, userId: 42 }, NOW)
    ).toBe(true);
  });
});

describe("cancel consequences copy", () => {
  const paid = tourBooking({
    payment: {
      id: 1,
      amount: 150000,
      status: "COMPLETED",
      paymentMethod: "MOBILE_MONEY",
    },
    status: "CONFIRMED",
  });

  it("flags a refund only for a COMPLETED payment", () => {
    expect(cancelRequestsRefund(paid)).toBe(true);
    expect(cancelRequestsRefund(tourBooking())).toBe(false);
    expect(
      cancelRequestsRefund(
        tourBooking({
          payment: {
            id: 1,
            amount: 1,
            status: "PENDING",
            paymentMethod: "MOBILE_MONEY",
          },
        })
      )
    ).toBe(false);
  });

  it("mentions the refund in the paid booking's dialog copy", () => {
    expect(cancelDialogDescription(paid)).toContain(
      "payment will be marked for refund"
    );
    expect(cancelDialogDescription(tourBooking())).not.toContain("refund");
  });
});
