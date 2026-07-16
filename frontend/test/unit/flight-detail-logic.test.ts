// test/unit/flight-detail-logic.test.ts
import { describe, expect, it } from "vitest";
import {
  formatFlightDuration,
  getAvailableStatusTransitions,
  getDestinationDisplayName,
  getFlightStatusConfig,
  validateDelaySchedule,
} from "@/components/flights/flight-detail-logic";

describe("flight status transitions", () => {
  it("follows the flight lifecycle", () => {
    expect(getAvailableStatusTransitions("SCHEDULED")).toEqual([
      "DELAYED",
      "CANCELLED",
      "DEPARTED",
    ]);
    expect(getAvailableStatusTransitions("DEPARTED")).toEqual(["LANDED"]);
    expect(getAvailableStatusTransitions("LANDED")).toEqual([]);
    expect(getAvailableStatusTransitions("UNKNOWN")).toEqual([]);
  });

  it("labels known statuses and falls back to the raw value", () => {
    expect(getFlightStatusConfig("CANCELLED")).toMatchObject({
      variant: "destructive",
      label: "Cancelled",
    });
    expect(getFlightStatusConfig("WEIRD")).toMatchObject({
      variant: "secondary",
      label: "WEIRD",
    });
  });
});

describe("formatFlightDuration", () => {
  it("renders hours and minutes", () => {
    expect(formatFlightDuration(90)).toBe("1h 30m");
    expect(formatFlightDuration(45)).toBe("45m");
    expect(formatFlightDuration(60)).toBe("1h 0m");
  });
});

describe("getDestinationDisplayName", () => {
  it("includes the city when present", () => {
    expect(
      getDestinationDisplayName({
        name: "Kotoka Intl",
        city: "Accra",
        country: "Ghana",
      })
    ).toBe("Kotoka Intl (Accra, Ghana)");
  });

  it("omits a missing city", () => {
    expect(
      getDestinationDisplayName({
        name: "Tamale Airport",
        city: null,
        country: "Ghana",
      })
    ).toBe("Tamale Airport (Ghana)");
  });
});

describe("validateDelaySchedule", () => {
  const now = new Date("2026-07-16T08:00:00Z");
  const original = new Date("2026-07-16T10:00:00Z");
  const at = (iso: string) => new Date(iso);

  it("requires both times", () => {
    expect(validateDelaySchedule(undefined, undefined, original, now)).toEqual({
      ok: false,
      error: "Please select both departure and arrival times",
    });
  });

  it("requires arrival after departure", () => {
    const result = validateDelaySchedule(
      at("2026-07-16T12:00:00Z"),
      at("2026-07-16T11:00:00Z"),
      original,
      now
    );
    expect(result).toEqual({
      ok: false,
      error: "Arrival time must be after departure time",
    });
  });

  it("requires the new departure to be in the future", () => {
    const result = validateDelaySchedule(
      at("2026-07-16T07:00:00Z"),
      at("2026-07-16T09:00:00Z"),
      original,
      now
    );
    expect(result).toEqual({
      ok: false,
      error: "Departure time must be in the future",
    });
  });

  it("requires the new departure to be after the original", () => {
    const result = validateDelaySchedule(
      at("2026-07-16T09:00:00Z"),
      at("2026-07-16T11:00:00Z"),
      original,
      now
    );
    expect(result).toEqual({
      ok: false,
      error: "Delayed departure must be later than original departure",
    });
  });

  it("bounds the duration between 10 minutes and 24 hours", () => {
    expect(
      validateDelaySchedule(
        at("2026-07-16T11:00:00Z"),
        at("2026-07-16T11:05:00Z"),
        original,
        now
      )
    ).toEqual({
      ok: false,
      error: "Flight duration cannot be less than 10 minutes",
    });
    expect(
      validateDelaySchedule(
        at("2026-07-16T11:00:00Z"),
        at("2026-07-17T12:00:00Z"),
        original,
        now
      )
    ).toEqual({
      ok: false,
      error: "Flight duration cannot exceed 24 hours",
    });
  });

  it("accepts a valid reschedule", () => {
    expect(
      validateDelaySchedule(
        at("2026-07-16T11:00:00Z"),
        at("2026-07-16T13:00:00Z"),
        original,
        now
      )
    ).toEqual({ ok: true });
  });
});
