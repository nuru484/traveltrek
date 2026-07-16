// test/component/reports-role-views.test.tsx
//
// /dashboard/reports is role-aware (mirrors the backend gates): ADMIN keeps
// the four analytics tabs, AGENT gets "My activity" (self-scoped), and
// customers get "My travel summary". Sections are stubbed — this drives the
// routing/heading layer only.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { IAuthUser } from "@/types/auth";
import ReportsPage from "@/app/dashboard/reports/page";
import {
  reportsViewForRole,
} from "@/components/reports/reports-view-logic";

let mockUser: IAuthUser | null = null;
vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { user: mockUser } }),
}));

vi.mock("@/components/reports/OverviewSection", () => ({
  OverviewSection: () => <div data-testid="overview-section" />,
}));
vi.mock("@/components/reports/BookingsSection", () => ({
  BookingsSection: () => <div data-testid="bookings-section" />,
}));
vi.mock("@/components/reports/PaymentsSection", () => ({
  PaymentsSection: () => <div data-testid="payments-section" />,
}));
vi.mock("@/components/reports/ToursSection", () => ({
  ToursSection: () => <div data-testid="tours-section" />,
}));
vi.mock("@/components/reports/MyActivitySection", () => ({
  MyActivitySection: () => <div data-testid="my-activity-section" />,
}));
vi.mock("@/components/reports/MyTravelSummarySection", () => ({
  MyTravelSummarySection: () => <div data-testid="my-travel-section" />,
}));

const base = { id: 1, name: "A", createdAt: "", updatedAt: "" };

describe("reportsViewForRole", () => {
  it("maps roles onto their reports surface", () => {
    expect(reportsViewForRole("ADMIN")).toBe("admin-tabs");
    expect(reportsViewForRole("AGENT")).toBe("agent-activity");
    expect(reportsViewForRole("CUSTOMER")).toBe("customer-summary");
  });
});

describe("ReportsPage per role", () => {
  it("ADMIN sees the four analytics tabs, no self reports", () => {
    mockUser = { ...base, role: "ADMIN" };
    render(<ReportsPage />);
    expect(screen.getByText("Reports & Analytics")).toBeInTheDocument();
    expect(screen.getByTestId("overview-section")).toBeInTheDocument();
    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent)
    ).toEqual(["Overview", "Bookings", "Payments", "Tours"]);
    expect(screen.queryByTestId("my-activity-section")).toBeNull();
    expect(screen.queryByTestId("my-travel-section")).toBeNull();
  });

  it("AGENT sees only My Activity", () => {
    mockUser = { ...base, role: "AGENT" };
    render(<ReportsPage />);
    expect(screen.getByText("My Activity")).toBeInTheDocument();
    expect(screen.getByTestId("my-activity-section")).toBeInTheDocument();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByTestId("overview-section")).toBeNull();
  });

  it("customers (no role field) see only My Travel Summary", () => {
    mockUser = { ...base };
    render(<ReportsPage />);
    expect(screen.getByText("My Travel Summary")).toBeInTheDocument();
    expect(screen.getByTestId("my-travel-section")).toBeInTheDocument();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByTestId("my-activity-section")).toBeNull();
  });
});
