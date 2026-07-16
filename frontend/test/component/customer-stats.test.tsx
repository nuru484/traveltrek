// test/component/customer-stats.test.tsx
//
// The customer profile's lifetime-activity block: pesewas through
// formatMoney, bookingsByStatus chips, and the null-safe branches (no
// favorite destination, no completed payment → em dashes, never blanks).
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CustomerStats } from "@/components/customers/CustomerStats";
import type { ICustomerProfile } from "@/types/customer.types";

const baseStats: ICustomerProfile["stats"] = {
  averageBookingValue: 62550,
  bookingsByStatus: { PENDING: 2, COMPLETED: 1 },
  favoriteDestination: { id: 4, name: "Cape Coast" },
  lastBookingAt: "2026-07-01T10:00:00.000Z",
  memberSince: "2025-02-10T08:00:00.000Z",
  signupMethod: "email",
  totalBookings: 3,
  totalPayments: 2,
  totalSpent: 125100,
  upcomingTrips: 1,
};

const emptyStats: ICustomerProfile["stats"] = {
  averageBookingValue: null,
  bookingsByStatus: {},
  favoriteDestination: null,
  lastBookingAt: null,
  memberSince: "2026-07-10T08:00:00.000Z",
  signupMethod: "phone",
  totalBookings: 0,
  totalPayments: 0,
  totalSpent: 0,
  upcomingTrips: 0,
};

describe("CustomerStats", () => {
  it("renders money figures and status chips for an active customer", () => {
    render(<CustomerStats stats={baseStats} />);

    // formatMoney(pesewas): 125100 → GH₵ 1,251.00; 62550 → GH₵ 625.50.
    expect(screen.getByText("GH₵ 1,251.00")).toBeInTheDocument();
    expect(screen.getByText("GH₵ 625.50")).toBeInTheDocument();
    expect(screen.getByText("Pending: 2")).toBeInTheDocument();
    expect(screen.getByText("Completed: 1")).toBeInTheDocument();

    // Favorite destination links to the destination detail page.
    const link = screen.getByRole("link", { name: /cape coast/i });
    expect(link).toHaveAttribute("href", "/dashboard/destinations/4/detail");
  });

  it("renders null-safe em dashes for a brand-new customer", () => {
    render(<CustomerStats stats={emptyStats} />);

    // No favorite destination and no last booking — em dashes, no link.
    expect(
      screen.getByLabelText("No favorite destination")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("No bookings yet")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    // Null average renders the em dash with its explainer.
    expect(screen.getByText("No completed payments")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);

    // Zero spent still renders as money, not blank.
    expect(screen.getByText("GH₵ 0.00")).toBeInTheDocument();
  });
});
