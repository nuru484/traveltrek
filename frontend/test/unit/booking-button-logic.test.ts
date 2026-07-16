// test/unit/booking-button-logic.test.ts
import { describe, expect, it } from "vitest";
import {
  buildBookingPayload,
  calculateTotalPrice,
  clampGuests,
  clampRooms,
} from "@/components/bookings/booking-button-logic";

describe("count clamps", () => {
  it("clamps guests to 1–20 and survives junk input", () => {
    expect(clampGuests("5")).toBe(5);
    expect(clampGuests("0")).toBe(1);
    expect(clampGuests("-3")).toBe(1);
    expect(clampGuests("25")).toBe(20);
    expect(clampGuests("")).toBe(1);
    expect(clampGuests("abc")).toBe(1);
  });

  it("clamps rooms to 1–10", () => {
    expect(clampRooms("3")).toBe(3);
    expect(clampRooms("11")).toBe(10);
    expect(clampRooms("")).toBe(1);
  });
});

describe("calculateTotalPrice", () => {
  it("multiplies the per-guest minor units by the guest count", () => {
    expect(calculateTotalPrice(150_00, 3)).toBe(450_00);
    expect(calculateTotalPrice(150_00, 1)).toBe(150_00);
  });
});

describe("buildBookingPayload", () => {
  const base = {
    customerId: 7,
    totalPrice: 300_00,
    numberOfGuests: 2,
    specialRequests: "  window seat  ",
  };

  it("builds a tour payload and trims special requests", () => {
    expect(buildBookingPayload({ ...base, tourId: 4 })).toEqual({
      customerId: 7,
      totalPrice: 300_00,
      numberOfGuests: 2,
      specialRequests: "window seat",
      tourId: 4,
    });
  });

  it("nulls blank special requests", () => {
    expect(
      buildBookingPayload({ ...base, specialRequests: "   ", flightId: 9 })
        .specialRequests
    ).toBeNull();
  });

  it("carries dates and room count only for room bookings", () => {
    const payload = buildBookingPayload({
      ...base,
      roomId: 2,
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      numberOfRooms: 2,
    });
    expect(payload).toMatchObject({
      roomId: 2,
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      numberOfRooms: 2,
    });
    expect(payload.tourId).toBeUndefined();
  });

  it("prefers tour over flight over room (checked in that order)", () => {
    const payload = buildBookingPayload({ ...base, tourId: 1, flightId: 2 });
    expect(payload.tourId).toBe(1);
    expect(payload.flightId).toBeUndefined();
  });

  it("throws when no booking type is given", () => {
    expect(() => buildBookingPayload(base)).toThrow(
      "No booking type specified"
    );
  });
});
