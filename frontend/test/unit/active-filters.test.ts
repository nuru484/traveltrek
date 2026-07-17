// test/unit/active-filters.test.ts
//
// hasActiveFilterValues drives the list surfaces' "no data at all vs filtered
// to nothing" split: only meaningful values count as an active filter.
import { describe, expect, it } from "vitest";
import { hasActiveFilterValues } from "@/utils/active-filters";

describe("hasActiveFilterValues", () => {
  it("is false for an empty filters object", () => {
    expect(hasActiveFilterValues({})).toBe(false);
  });

  it("is false when every value is undefined, null or empty string", () => {
    expect(
      hasActiveFilterValues({ search: undefined, status: null, city: "" })
    ).toBe(false);
  });

  it("is true when a string filter is set", () => {
    expect(hasActiveFilterValues({ search: "accra", status: undefined })).toBe(
      true
    );
  });

  it("is true for meaningful non-string values (numbers, booleans, 0, false)", () => {
    expect(hasActiveFilterValues({ minPrice: 5000 })).toBe(true);
    expect(hasActiveFilterValues({ minPrice: 0 })).toBe(true);
    expect(hasActiveFilterValues({ isFeatured: false })).toBe(true);
  });

  it("callers exclude sort defaults by destructuring them off first", () => {
    const filters = {
      search: undefined,
      country: undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
    };
    // Raw shape would (wrongly) read as active because of the sort defaults…
    expect(hasActiveFilterValues(filters)).toBe(true);
    // …so callers strip them before asking.
    const { sortBy: _sortBy, sortOrder: _sortOrder, ...rest } = filters;
    void _sortBy;
    void _sortOrder;
    expect(hasActiveFilterValues(rest)).toBe(false);
  });
});
