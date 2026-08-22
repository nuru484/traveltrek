// test/unit/table-query-state-logic.test.ts
//
// The pure half of the URL + session table state:
// parse <-> serialize round-trips, garbage tolerance, default detection and
// the API param builder.
import { describe, expect, it } from "vitest";
import {
  buildTableQueryParams,
  filtersEqual,
  isDefaultTableState,
  parseFiltersFromParams,
  parsePositiveIntParam,
  serializeTableState,
  type TableFiltersSpec,
} from "@/hooks/table-query-state-logic";

type TestFilters = {
  search?: string;
  status?: string;
  rating?: number;
};

const SPEC: TableFiltersSpec<TestFilters> = {
  search: { kind: "string" },
  status: { kind: "enum", values: ["PENDING", "CONFIRMED"] },
  rating: { kind: "number" },
};

describe("parsePositiveIntParam", () => {
  it("parses positive integers and falls back on garbage", () => {
    expect(parsePositiveIntParam("3", 1)).toBe(3);
    expect(parsePositiveIntParam(null, 1)).toBe(1);
    expect(parsePositiveIntParam("0", 1)).toBe(1);
    expect(parsePositiveIntParam("-2", 1)).toBe(1);
    expect(parsePositiveIntParam("abc", 5)).toBe(5);
  });
});

describe("parseFiltersFromParams", () => {
  it("reads every declared key, dropping garbage enum/number values", () => {
    const params = new URLSearchParams(
      "search=ama&status=NOT_A_STATUS&rating=x"
    );
    expect(parseFiltersFromParams(params, SPEC)).toEqual({
      search: "ama",
      status: undefined,
      rating: undefined,
    });
  });

  it("keeps valid enum values (deep links from needs-attention tiles)", () => {
    const params = new URLSearchParams("status=PENDING");
    expect(parseFiltersFromParams(params, SPEC).status).toBe("PENDING");
  });
});

describe("serialize <-> parse round-trip", () => {
  it("survives a URL round-trip", () => {
    const filters: TestFilters = { search: "ama", status: "CONFIRMED" };
    const serialized = serializeTableState(3, 25, filters, SPEC);
    expect(serialized.get("page")).toBe("3");
    expect(serialized.get("limit")).toBe("25");

    const reparsed = parseFiltersFromParams(
      new URLSearchParams(serialized.toString()),
      SPEC
    );
    expect(filtersEqual(reparsed, filters, SPEC)).toBe(true);
  });

  it("omits empty/undefined filters from the URL", () => {
    const serialized = serializeTableState(
      1,
      10,
      { search: "", status: undefined },
      SPEC
    );
    expect(serialized.toString()).toBe("page=1&limit=10");
  });
});

describe("isDefaultTableState", () => {
  it("is true only at page 1, default size, no meaningful filters", () => {
    expect(isDefaultTableState(1, 10, {}, SPEC, 10)).toBe(true);
    expect(isDefaultTableState(1, 10, { search: "  " }, SPEC, 10)).toBe(true);
    expect(isDefaultTableState(2, 10, {}, SPEC, 10)).toBe(false);
    expect(isDefaultTableState(1, 25, {}, SPEC, 10)).toBe(false);
    expect(isDefaultTableState(1, 10, { search: "x" }, SPEC, 10)).toBe(false);
  });
});

describe("buildTableQueryParams", () => {
  it("strips empty values so they never hit the request URL", () => {
    expect(
      buildTableQueryParams(2, 10, {
        search: "",
        status: "PENDING",
        rating: undefined,
      })
    ).toEqual({ page: 2, limit: 10, status: "PENDING" });
  });
});
