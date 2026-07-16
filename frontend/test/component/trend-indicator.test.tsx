// test/component/trend-indicator.test.tsx
//
// The per-KPI trend chip: direction picks the icon + colour, percentage is
// rendered as an absolute value against "vs previous".
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendIndicator } from "@/components/reports/report-charts";

describe("TrendIndicator", () => {
  it("renders an upward trend in green", () => {
    render(<TrendIndicator direction="up" percentage={12.5} />);
    const chip = screen.getByText("12.5% vs previous");
    expect(chip.className).toContain("text-green-600");
  });

  it("renders a downward trend in red", () => {
    render(<TrendIndicator direction="down" percentage={40} />);
    const chip = screen.getByText("40% vs previous");
    expect(chip.className).toContain("text-red-600");
  });

  it("renders a flat trend muted", () => {
    render(<TrendIndicator direction="flat" percentage={0} />);
    const chip = screen.getByText("0% vs previous");
    expect(chip.className).toContain("text-muted-foreground");
  });

  it("shows the absolute percentage (direction carries the sign)", () => {
    render(<TrendIndicator direction="down" percentage={-25} />);
    expect(screen.getByText("25% vs previous")).toBeInTheDocument();
  });
});
