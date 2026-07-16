// test/unit/table-empty-logic.test.ts
//
// Empty-state semantics (dms/website pattern): no data + no filters replaces
// the whole table scaffold with an EmptyState (no toolbar/headers/pagination);
// an empty FILTERED result keeps the toolbar and offers a clear action.
import { describe, expect, it } from "vitest";
import {
  clearAllFiltersPatch,
  hasActiveTableFilters,
  isMeaningfulFilterValue,
  tableEmptyMode,
} from "@/components/ui/table-empty-logic";

describe("isMeaningfulFilterValue / hasActiveTableFilters", () => {
  it("ignores undefined, null, empty and whitespace-only strings", () => {
    expect(isMeaningfulFilterValue(undefined)).toBe(false);
    expect(isMeaningfulFilterValue(null)).toBe(false);
    expect(isMeaningfulFilterValue("")).toBe(false);
    expect(isMeaningfulFilterValue("   ")).toBe(false);
    expect(isMeaningfulFilterValue("PENDING")).toBe(true);
    expect(isMeaningfulFilterValue(0)).toBe(true);
    expect(isMeaningfulFilterValue(false)).toBe(true);
  });

  it("detects any active filter across the object", () => {
    expect(hasActiveTableFilters({})).toBe(false);
    expect(
      hasActiveTableFilters({ search: undefined, status: undefined })
    ).toBe(false);
    expect(hasActiveTableFilters({ search: "", status: "PENDING" })).toBe(
      true
    );
    expect(hasActiveTableFilters({ search: "ama" })).toBe(true);
  });
});

describe("tableEmptyMode", () => {
  it("is null while loading or when rows exist", () => {
    expect(tableEmptyMode(true, 0, false)).toBeNull();
    expect(tableEmptyMode(false, 5, false)).toBeNull();
    expect(tableEmptyMode(false, 5, true)).toBeNull();
  });

  it("no data + no filters -> 'no-data' (EmptyState only, toolbar hidden)", () => {
    expect(tableEmptyMode(false, 0, false)).toBe("no-data");
  });

  it("no data + active filters -> 'filtered-empty' (toolbar stays)", () => {
    expect(tableEmptyMode(false, 0, true)).toBe("filtered-empty");
  });
});

describe("clearAllFiltersPatch", () => {
  it("clears every declared key so the toolbar and query reset together", () => {
    expect(
      clearAllFiltersPatch({ search: "ama", status: "PENDING", rating: 4 })
    ).toEqual({ search: undefined, status: undefined, rating: undefined });
  });
});
