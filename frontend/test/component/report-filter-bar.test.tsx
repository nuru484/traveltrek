// test/component/report-filter-bar.test.tsx
//
// ReportFilterBar's two renderings: at or under the inline threshold the
// controls render straight into the toolbar (no Filters button/panel);
// above it they collapse behind the Filters button.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";

describe("ReportFilterBar", () => {
  it("renders controls inline (no Filters button) at the period-only count", () => {
    render(
      <ReportFilterBar
        controlCount={1}
        filterCount={0}
        hasFiltersApplied={false}
        onClearAll={() => {}}
        filterFields={<div data-testid="controls" />}
      />
    );
    expect(screen.getByTestId("controls")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /filters/i })).toBeNull();
  });

  it("offers an inline Clear action once filters are applied", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    render(
      <ReportFilterBar
        controlCount={1}
        filterCount={1}
        hasFiltersApplied
        onClearAll={onClearAll}
        filterFields={<div />}
      />
    );
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("keeps the collapsed Filters button above the threshold", async () => {
    const user = userEvent.setup();
    render(
      <ReportFilterBar
        controlCount={3}
        filterCount={0}
        hasFiltersApplied={false}
        onClearAll={() => {}}
        filterFields={<div data-testid="controls" />}
      />
    );
    // Collapsed by default; the button rolls the panel out.
    expect(screen.queryByTestId("controls")).toBeNull();
    await user.click(screen.getByRole("button", { name: /filters/i }));
    expect(screen.getByTestId("controls")).toBeInTheDocument();
  });
});
