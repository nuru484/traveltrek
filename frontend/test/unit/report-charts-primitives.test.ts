// test/unit/report-charts-primitives.test.ts
//
// The pure primitives behind the report/dashboard chart cards, now split into
// their own module: the compact-money axis formatter, the status/method label
// map, and the segment value formatter. Input money is integer pesewas.
import { describe, expect, it } from "vitest";
import {
  compactMoney,
  formatCompactValue,
  label,
} from "@/components/reports/report-charts/primitives";

describe("compactMoney", () => {
  it("renders sub-thousand cedis as a rounded whole figure", () => {
    expect(compactMoney(0)).toBe("GH₵ 0");
    expect(compactMoney(100)).toBe("GH₵ 1");
    expect(compactMoney(99_950)).toBe("GH₵ 1000");
  });

  it("compacts thousands with one decimal", () => {
    expect(compactMoney(150_000)).toBe("GH₵ 1.5k");
    expect(compactMoney(1_234_500)).toBe("GH₵ 12.3k");
  });

  it("compacts millions with one decimal", () => {
    expect(compactMoney(100_000_000)).toBe("GH₵ 1.0M");
    expect(compactMoney(245_000_000)).toBe("GH₵ 2.5M");
  });

  it("keeps the sign on negatives", () => {
    expect(compactMoney(-150_000)).toBe("GH₵ -1.5k");
  });
});

describe("label", () => {
  it("maps known status/method/type keys to their display copy", () => {
    expect(label("REFUND_REQUESTED")).toBe("Refund requested");
    expect(label("MOBILE_MONEY")).toBe("Mobile money");
    expect(label("TOUR")).toBe("Tours");
  });

  it("falls back to the raw key when unmapped", () => {
    expect(label("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("formatCompactValue", () => {
  it("routes money through compactMoney", () => {
    expect(formatCompactValue("money", 150_000)).toBe("GH₵ 1.5k");
  });

  it("renders counts as localized integers", () => {
    expect(formatCompactValue("count", 1234)).toBe((1234).toLocaleString());
  });
});
