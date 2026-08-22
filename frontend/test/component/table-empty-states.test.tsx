// test/component/table-empty-states.test.tsx
//
// Data-table empty-state semantics, driven through the customers table:
// with NO data and NO filters the page shows ONLY an
// EmptyState (no toolbar, no headers, no pagination); with filters active
// and zero matches, the toolbar stays and the body offers a clear action.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomersDataTable } from "@/components/customers/table/customers-data-table";
import { TourList } from "@/components/tours/tour-list";

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { user: { id: 1, name: "Admin", role: "ADMIN" } } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/customers/table/CustomerActionsDropdown", () => ({
  CustomerActionsDropdown: () => null,
}));

const baseProps = {
  data: [],
  loading: false,
  totalCount: 0,
  page: 1,
  pageSize: 10,
  onPageChange: () => {},
  onPageSizeChange: () => {},
};

describe("data-table empty-state semantics", () => {
  it("no data + no filters: EmptyState only — no toolbar/headers/pagination", () => {
    render(
      <CustomersDataTable
        {...baseProps}
        filters={{ search: undefined }}
        onFiltersChange={() => {}}
      />
    );

    expect(screen.getByText("No customers yet.")).toBeInTheDocument();
    // Toolbar (search input) hidden
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    // No table headers, no pagination
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/rows per page/i)).toBeNull();
  });

  it("filtered to nothing: toolbar stays, clear-filters offered", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <CustomersDataTable
        {...baseProps}
        filters={{ search: "zzz" }}
        onFiltersChange={onFiltersChange}
      />
    );

    // Toolbar still visible with the active search
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    // Both renderings (row cards + md table) show the filtered-empty state
    expect(
      screen.getAllByText("No customers match these filters.").length
    ).toBeGreaterThanOrEqual(1);

    await user.click(
      screen.getAllByRole("button", { name: "Clear filters" })[0]
    );
    expect(onFiltersChange).toHaveBeenCalledWith({ search: undefined });
  });

  it("rows present: the normal table renders (no empty states)", () => {
    render(
      <CustomersDataTable
        {...baseProps}
        data={[
          {
            id: 1,
            name: "Ama Mensah",
            email: "ama@example.com",
            phone: null,
            address: null,
            profilePicture: null,
            createdAt: "2026-07-01T00:00:00Z",
            updatedAt: "2026-07-01T00:00:00Z",
          },
        ] as never}
        totalCount={1}
        filters={{ search: undefined }}
        onFiltersChange={() => {}}
      />
    );

    expect(screen.queryByText("No customers yet.")).toBeNull();
    expect(screen.queryByText("No customers match these filters.")).toBeNull();
    expect(screen.getAllByText("Ama Mensah").length).toBeGreaterThanOrEqual(1);
  });
});

// The list-style surfaces (tours/hotels/flights/destinations) follow the same
// discipline via hasActiveFilterValues; TourList is the reference.
const tourListBaseProps = {
  data: [],
  isLoading: false,
  isError: false,
  error: undefined,
  meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
  onPageChange: () => {},
  onLimitChange: () => {},
  onFiltersChange: () => {},
  onRefetch: () => {},
};

describe("list-surface empty-state semantics (TourList)", () => {
  it("no data + no filters: domain EmptyState only, with the create action", () => {
    render(
      <TourList
        {...tourListBaseProps}
        filters={{ search: undefined, type: undefined, status: undefined }}
        toolbarActions={<button type="button">Create Tour</button>}
      />
    );

    expect(screen.getByText("No tours yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Tour" })
    ).toBeInTheDocument();
    // No filter bar, no results-count header
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    expect(screen.queryByText(/tours? found/i)).toBeNull();
  });

  it("no data + no filters without a create action (non-admin): no CTA", () => {
    render(<TourList {...tourListBaseProps} filters={{}} />);

    expect(screen.getByText("No tours yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Tour" })).toBeNull();
  });

  it("filtered to nothing: filter bar stays with the no-matches message", () => {
    render(
      <TourList
        {...tourListBaseProps}
        filters={{ search: "zzz", type: undefined, status: undefined }}
      />
    );

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByText("No tours found.")).toBeInTheDocument();
    expect(screen.queryByText("No tours yet.")).toBeNull();
  });

  it("loading: skeletons, never the EmptyState", () => {
    render(<TourList {...tourListBaseProps} isLoading filters={{}} />);

    expect(screen.queryByText("No tours yet.")).toBeNull();
    expect(screen.queryByText("No tours found.")).toBeNull();
  });
});
