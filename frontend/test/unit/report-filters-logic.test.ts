// test/unit/report-filters-logic.test.ts
//
// The pure preset → API date-range mapping behind the reports filter bar.
// Windows are built in local time; endDate carries an explicit end-of-day
// time so the API window includes the whole final day.
import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  INLINE_FILTER_THRESHOLD,
  isInlineFilterBar,
  periodToParams,
  presetRange,
} from "@/components/reports/report-filters-logic";

// Wednesday, 15 July 2026, mid-afternoon local time.
const NOW = new Date(2026, 6, 15, 15, 30, 0);

describe("presetRange", () => {
  it("TODAY spans just the current day", () => {
    expect(presetRange("TODAY", NOW)).toEqual({
      startDate: "2026-07-15",
      endDate: "2026-07-15T23:59:59",
    });
  });

  it("THIS_WEEK runs Monday through Sunday", () => {
    expect(presetRange("THIS_WEEK", NOW)).toEqual({
      startDate: "2026-07-13",
      endDate: "2026-07-19T23:59:59",
    });
  });

  it("THIS_WEEK handles a Sunday (week still starts the previous Monday)", () => {
    const sunday = new Date(2026, 6, 19, 9, 0, 0);
    expect(presetRange("THIS_WEEK", sunday)).toEqual({
      startDate: "2026-07-13",
      endDate: "2026-07-19T23:59:59",
    });
  });

  it("THIS_MONTH spans the calendar month", () => {
    expect(presetRange("THIS_MONTH", NOW)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31T23:59:59",
    });
  });

  it("LAST_MONTH spans the previous calendar month", () => {
    expect(presetRange("LAST_MONTH", NOW)).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-30T23:59:59",
    });
  });

  it("LAST_MONTH crosses the year boundary in January", () => {
    const january = new Date(2026, 0, 10);
    expect(presetRange("LAST_MONTH", january)).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31T23:59:59",
    });
  });

  it("THIS_QUARTER spans the calendar quarter", () => {
    expect(presetRange("THIS_QUARTER", NOW)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-09-30T23:59:59",
    });
  });

  it("THIS_YEAR and LAST_YEAR span whole years", () => {
    expect(presetRange("THIS_YEAR", NOW)).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-12-31T23:59:59",
    });
    expect(presetRange("LAST_YEAR", NOW)).toEqual({
      startDate: "2025-01-01",
      endDate: "2025-12-31T23:59:59",
    });
  });
});

describe("periodToParams", () => {
  it("maps a preset selection through presetRange", () => {
    expect(periodToParams("THIS_MONTH", NOW)).toEqual(
      presetRange("THIS_MONTH", NOW),
    );
  });

  it("CUSTOM uses only the applied dates", () => {
    expect(periodToParams("CUSTOM", NOW)).toEqual({});
    expect(
      periodToParams("CUSTOM", NOW, new Date(2026, 2, 1), new Date(2026, 2, 20)),
    ).toEqual({
      startDate: "2026-03-01",
      endDate: "2026-03-20T23:59:59",
    });
  });

  it("CUSTOM with only a start date sends just startDate", () => {
    expect(periodToParams("CUSTOM", NOW, new Date(2026, 2, 1))).toEqual({
      startDate: "2026-03-01",
    });
  });
});

describe("countActiveFilters", () => {
  it("counts set entity filters", () => {
    expect(countActiveFilters("THIS_MONTH", [undefined, undefined])).toBe(0);
    expect(countActiveFilters("THIS_MONTH", ["CONFIRMED", undefined])).toBe(1);
    expect(countActiveFilters("THIS_MONTH", ["CONFIRMED", "ADVENTURE"])).toBe(2);
  });

  it("counts a non-default period as one filter", () => {
    expect(countActiveFilters("LAST_MONTH", [])).toBe(1);
    expect(countActiveFilters("CUSTOM", ["CONFIRMED"])).toBe(2);
    expect(countActiveFilters("THIS_MONTH", [])).toBe(0);
  });
});

describe("isInlineFilterBar", () => {
  it("renders inline at or under the threshold, panel above it", () => {
    // Rule: more than 2 controls earns the collapsed Filters panel;
    // 1-2 controls render inline in the toolbar.
    expect(INLINE_FILTER_THRESHOLD).toBe(2);
    expect(isInlineFilterBar(1)).toBe(true); // Overview / my-report tabs
    expect(isInlineFilterBar(2)).toBe(true); // Bookings, Payments
    expect(isInlineFilterBar(3)).toBe(false); // Tours keeps the panel
    expect(isInlineFilterBar(4)).toBe(false);
  });
});
