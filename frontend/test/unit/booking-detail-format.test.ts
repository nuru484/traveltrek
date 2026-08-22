// test/unit/booking-detail-format.test.ts
//
// The pure presentation helpers behind the booking detail view: the
// status/payment badge colour maps and the payment-deadline check.
import { describe, expect, it, vi } from "vitest";
import {
  getPaymentStatusColor,
  getStatusColor,
  isPaymentDeadlinePassed,
} from "@/components/bookings/booking-detail/format";

describe("getStatusColor", () => {
  it("maps each known booking status to its badge classes", () => {
    expect(getStatusColor("PENDING")).toContain("amber");
    expect(getStatusColor("CONFIRMED")).toContain("green");
    expect(getStatusColor("CANCELLED")).toContain("red");
    expect(getStatusColor("COMPLETED")).toContain("blue");
  });

  it("falls back to muted for an unknown status", () => {
    expect(getStatusColor("WHATEVER")).toBe("bg-muted text-muted-foreground");
  });
});

describe("getPaymentStatusColor", () => {
  it("maps each known payment status to its badge classes", () => {
    expect(getPaymentStatusColor("PENDING")).toContain("amber");
    expect(getPaymentStatusColor("COMPLETED")).toContain("green");
    expect(getPaymentStatusColor("FAILED")).toContain("red");
    expect(getPaymentStatusColor("REFUNDED")).toContain("orange");
    expect(getPaymentStatusColor("REFUND_REQUESTED")).toContain("purple");
  });

  it("falls back to muted for an unknown status", () => {
    expect(getPaymentStatusColor("WHATEVER")).toBe(
      "bg-muted text-muted-foreground"
    );
  });
});

describe("isPaymentDeadlinePassed", () => {
  it("is true for a past deadline and false for a future one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00Z"));
    expect(isPaymentDeadlinePassed("2026-07-16T12:00:00Z")).toBe(true);
    expect(isPaymentDeadlinePassed("2026-07-18T12:00:00Z")).toBe(false);
    vi.useRealTimers();
  });
});
