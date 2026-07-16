// test/unit/format-money.test.ts
//
// The ONE money formatter: integer pesewas in, GHS out — exact with
// separators below a million cedis, compact beyond, exact on demand.
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/utils/format-money";

describe("formatMoney", () => {
  it("renders pesewas as cedis with two decimals", () => {
    expect(formatMoney(100)).toBe("GH₵ 1.00");
    expect(formatMoney(123450)).toBe("GH₵ 1,234.50");
    expect(formatMoney(0)).toBe("GH₵ 0.00");
  });

  it("keeps thousands separators up to GH₵ 999,999.99", () => {
    expect(formatMoney(99_999_999)).toBe("GH₵ 999,999.99");
  });

  it("compacts amounts of a million cedis and beyond", () => {
    expect(formatMoney(100_000_000)).toBe("GH₵ 1M");
    expect(formatMoney(2_450_000_000)).toBe("GH₵ 24.5M");
  });

  it("renders the exact figure when asked", () => {
    expect(formatMoney(2_450_000_000, { exact: true })).toBe(
      "GH₵ 24,500,000.00"
    );
  });

  it("compacts negative worst cases too", () => {
    expect(formatMoney(-100_000_000)).toBe("GH₵ -1M");
  });

  it("falls back to zero for non-finite input", () => {
    expect(formatMoney(Number.NaN)).toBe("GH₵ 0.00");
    expect(formatMoney(Infinity)).toBe("GH₵ 0.00");
  });
});
