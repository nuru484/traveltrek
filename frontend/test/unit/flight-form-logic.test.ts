// test/unit/flight-form-logic.test.ts
import { describe, expect, it } from "vitest";
import {
  buildFlightFormData,
  getSelectionDisplayText,
  toDatetimeLocalValue,
} from "@/components/flights/flight-form-logic";
import { IFlightClass } from "@/types/flight.types";
import type { IDestination } from "@/types/destination.types";
import type { IFlightFormValues } from "@/validation/flights-validation";

describe("toDatetimeLocalValue", () => {
  it("trims an ISO timestamp to datetime-local precision", () => {
    expect(toDatetimeLocalValue("2026-07-16T10:30:00.000Z")).toBe(
      "2026-07-16T10:30"
    );
  });

  it("returns an empty string for a missing value", () => {
    expect(toDatetimeLocalValue(undefined)).toBe("");
    expect(toDatetimeLocalValue("")).toBe("");
  });
});

describe("getSelectionDisplayText", () => {
  const options = [
    { id: 1, name: "Accra" },
    { id: 2, name: "Tamale" },
  ] as IDestination[];

  it("shows the placeholder when nothing is selected", () => {
    expect(getSelectionDisplayText(0, null, options, "Select origin")).toBe(
      "Select origin"
    );
  });

  it("prefers the preset (edit mode) over the fetched options", () => {
    expect(
      getSelectionDisplayText(3, { id: 3, name: "Kumasi" }, options, "x")
    ).toBe("Kumasi");
  });

  it("falls back to the fetched options, then the placeholder", () => {
    expect(getSelectionDisplayText(2, null, options, "x")).toBe("Tamale");
    expect(getSelectionDisplayText(99, null, options, "Select origin")).toBe(
      "Select origin"
    );
  });
});

describe("buildFlightFormData", () => {
  const values: IFlightFormValues = {
    flightNumber: "GB123",
    airline: "Gbewaa Airlines",
    departure: "2026-07-16T10:30",
    arrival: "2026-07-16T12:30",
    originId: 1,
    destinationId: 2,
    price: 299.99,
    flightClass: IFlightClass.ECONOMY,
    stops: 0,
    capacity: 150,
    flightPhoto: undefined,
  };

  it("converts GHS decimals to integer pesewas", () => {
    const formData = buildFlightFormData(values);
    expect(formData.get("price")).toBe("29999");
  });

  it("serializes dates as ISO and carries scalar fields", () => {
    const formData = buildFlightFormData(values);
    expect(formData.get("departure")).toBe(
      new Date("2026-07-16T10:30").toISOString()
    );
    expect(formData.get("flightNumber")).toBe("GB123");
    expect(formData.get("stops")).toBe("0");
    expect(formData.get("capacity")).toBe("150");
    // No photo picked -> no multipart field at all.
    expect(formData.get("flightPhoto")).toBeNull();
  });

  it("appends the photo when one is picked", () => {
    const photo = new File(["x"], "plane.png", { type: "image/png" });
    const formData = buildFlightFormData({ ...values, flightPhoto: photo });
    expect(formData.get("flightPhoto")).toBe(photo);
  });

  it("sends flightPhoto as the empty string when removal is requested", () => {
    const formData = buildFlightFormData(values, { removePhoto: true });
    expect(formData.get("flightPhoto")).toBe("");
  });

  it("lets a picked photo win over a removal request", () => {
    const photo = new File(["x"], "plane.png", { type: "image/png" });
    const formData = buildFlightFormData(
      { ...values, flightPhoto: photo },
      { removePhoto: true }
    );
    expect(formData.get("flightPhoto")).toBe(photo);
  });
});
