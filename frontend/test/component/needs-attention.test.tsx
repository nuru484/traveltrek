// test/component/needs-attention.test.tsx
//
// The dashboard's needs-attention strip: one tile per operational count,
// each linking to the page (pre-filtered where supported) where the work
// gets done, plus the all-caught-up / items-to-review header state.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { INeedsAttentionCounts } from "@/types/dashboard.types";

const COUNTS: INeedsAttentionCounts = {
  pendingBookings: 3,
  pendingPayments: 2,
  failedPayments: 1,
  upcomingToursLowOccupancy: 4,
  flightsDepartingSoonLowSeats: 0,
};

describe("NeedsAttention", () => {
  it("renders a tile per count with its value and target link", () => {
    render(<NeedsAttention data={COUNTS} />);

    const pendingBookings = screen
      .getByText("Pending bookings")
      .closest("a");
    expect(pendingBookings).toHaveAttribute(
      "href",
      "/dashboard/bookings?status=PENDING",
    );
    expect(pendingBookings).toHaveTextContent("3");

    const failedPayments = screen.getByText("Failed payments").closest("a");
    expect(failedPayments).toHaveAttribute(
      "href",
      "/dashboard/payments?status=FAILED",
    );
    expect(failedPayments).toHaveTextContent("1");

    expect(
      screen.getByText("Low-occupancy tours").closest("a"),
    ).toHaveAttribute("href", "/dashboard/tours");
    expect(
      screen.getByText("Undersold flights").closest("a"),
    ).toHaveAttribute("href", "/dashboard/flights");
  });

  it("totals the counts in the header", () => {
    render(<NeedsAttention data={COUNTS} />);
    expect(screen.getByText("10 items to review")).toBeInTheDocument();
  });

  it("shows the all-caught-up state when every count is zero", () => {
    render(
      <NeedsAttention
        data={{
          pendingBookings: 0,
          pendingPayments: 0,
          failedPayments: 0,
          upcomingToursLowOccupancy: 0,
          flightsDepartingSoonLowSeats: 0,
        }}
      />,
    );
    expect(screen.getByText("All caught up")).toBeInTheDocument();
    expect(screen.queryByText(/to review/)).not.toBeInTheDocument();
  });
});
