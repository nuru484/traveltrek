// test/unit/bookings-table-logic.test.ts
import { describe, expect, it } from "vitest";
import {
  bookingServiceName,
  getPaymentStatusVariant,
  getStatusVariant,
} from "@/components/bookings/table/bookings-table-logic";
import type { IBooking } from "@/types/booking.types";

describe("bookingServiceName", () => {
  it("names a tour booking after the tour", () => {
    const booking = {
      type: "TOUR",
      tour: { name: "Mole Safari" },
    } as unknown as IBooking;
    expect(bookingServiceName(booking)).toBe("Mole Safari");
  });

  it("names a room booking after room type and hotel", () => {
    const booking = {
      type: "ROOM",
      room: { roomType: "Deluxe", hotel: { name: "Zaina Lodge" } },
    } as unknown as IBooking;
    expect(bookingServiceName(booking)).toBe("Deluxe - Zaina Lodge");
  });

  it("tolerates a room booking whose room was deleted", () => {
    const booking = { type: "ROOM", room: null } as unknown as IBooking;
    expect(bookingServiceName(booking)).toBe(" - ");
  });

  it("names a flight booking after airline and flight number", () => {
    const booking = {
      type: "FLIGHT",
      flight: { airline: "Gbewaa Airlines", flightNumber: "GB123" },
    } as unknown as IBooking;
    expect(bookingServiceName(booking)).toBe("Gbewaa Airlines GB123");
  });
});

describe("badge variants", () => {
  it("maps booking statuses to badge variants", () => {
    expect(getStatusVariant("CONFIRMED")).toBe("default");
    expect(getStatusVariant("COMPLETED")).toBe("secondary");
    expect(getStatusVariant("PENDING")).toBe("outline");
    expect(getStatusVariant("CANCELLED")).toBe("destructive");
  });

  it("maps payment statuses to badge variants, defaulting to outline", () => {
    expect(getPaymentStatusVariant("COMPLETED")).toBe("default");
    expect(getPaymentStatusVariant("FAILED")).toBe("destructive");
    expect(getPaymentStatusVariant("REFUNDED")).toBe("secondary");
    expect(getPaymentStatusVariant(undefined)).toBe("outline");
  });
});
