// test/component/table-empty-states.test.tsx
//
// Data-table empty-state semantics (dms/website pattern), driven through the
// customers table: with NO data and NO filters the page shows ONLY an
// EmptyState (no toolbar, no headers, no pagination); with filters active
// and zero matches, the toolbar stays and the body offers a clear action.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomersDataTable } from "@/components/customers/table/customers-data-table";

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
