// test/unit/tour-detail-logic.test.ts
import { describe, expect, it } from "vitest";
import {
  formatTourDuration,
  getAvailableStatusTransitions,
  getBookingButtonText,
  getDestinationDisplay,
  getTourStatusConfig,
  isBookingButtonDisabled,
} from "@/components/tours/tour-detail-logic";
import { TourStatus } from "@/types/tour.types";

describe("tour status transitions", () => {
  it("follows the tour lifecycle", () => {
    expect(getAvailableStatusTransitions("UPCOMING")).toEqual([
      "ONGOING",
      "CANCELLED",
    ]);
    expect(getAvailableStatusTransitions("ONGOING")).toEqual(["COMPLETED"]);
    expect(getAvailableStatusTransitions("COMPLETED")).toEqual([]);
    expect(getAvailableStatusTransitions("CANCELLED")).toEqual(["UPCOMING"]);
  });

  it("maps statuses to badge config", () => {
    expect(getTourStatusConfig("UPCOMING").variant).toBe("default");
    expect(getTourStatusConfig("CANCELLED").variant).toBe("destructive");
    expect(getTourStatusConfig("MYSTERY").label).toBe("MYSTERY");
  });
});

describe("display helpers", () => {
  it("pluralizes duration", () => {
    expect(formatTourDuration(1)).toBe("1 day");
    expect(formatTourDuration(3)).toBe("3 days");
  });

  it("formats the destination with and without a city", () => {
    expect(
      getDestinationDisplay({
        id: 1,
        name: "Mole Park",
        city: "Damongo",
        country: "Ghana",
      })
    ).toBe("Mole Park, Damongo, Ghana");
    expect(
      getDestinationDisplay({
        id: 2,
        name: "Mole Park",
        city: null,
        country: "Ghana",
      })
    ).toBe("Mole Park, Ghana");
    expect(getDestinationDisplay(null)).toBe("Unknown Destination");
  });
});

describe("booking button rules", () => {
  const base = {
    isBookingDataLoading: false,
    isTourBooked: false,
    isFullyBooked: false,
    bookingStatus: undefined,
  } as const;

  it("derives the button text from the booking state", () => {
    expect(getBookingButtonText({ ...base, isBookingDataLoading: true })).toBe(
      "Loading..."
    );
    expect(getBookingButtonText(base)).toBe("Book Now");
    expect(getBookingButtonText({ ...base, isFullyBooked: true })).toBe(
      "Fully Booked"
    );
    expect(
      getBookingButtonText({
        ...base,
        isTourBooked: true,
        bookingStatus: "PENDING",
      })
    ).toBe("Booked");
    expect(
      getBookingButtonText({
        ...base,
        isTourBooked: true,
        bookingStatus: "CONFIRMED",
      })
    ).toBe("Confirmed");
  });

  it("disables while loading, when full, or once terminal", () => {
    const flags = { ...base, isBooking: false, isCancelling: false };
    expect(isBookingButtonDisabled({ ...flags, tourStatus: TourStatus.UPCOMING })).toBe(
      false
    );
    expect(
      isBookingButtonDisabled({
        ...flags,
        tourStatus: TourStatus.UPCOMING,
        isFullyBooked: true,
      })
    ).toBe(true);
    // A booked guest can still act on a full tour.
    expect(
      isBookingButtonDisabled({
        ...flags,
        tourStatus: TourStatus.UPCOMING,
        isFullyBooked: true,
        isTourBooked: true,
        bookingStatus: "CONFIRMED",
      })
    ).toBe(false);
    expect(
      isBookingButtonDisabled({
        ...flags,
        tourStatus: TourStatus.UPCOMING,
        isTourBooked: true,
        bookingStatus: "CANCELLED",
      })
    ).toBe(true);
    expect(
      isBookingButtonDisabled({ ...flags, tourStatus: TourStatus.COMPLETED })
    ).toBe(true);
  });
});
