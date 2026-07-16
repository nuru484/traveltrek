// test/unit/payments-table-logic.test.ts
import { describe, expect, it } from "vitest";
import {
  getPaymentMethodLabel,
  getStatusVariant,
} from "@/components/payments/table/payments-table-logic";

describe("payments table logic", () => {
  it("maps payment statuses to badge variants", () => {
    expect(getStatusVariant("COMPLETED")).toBe("default");
    expect(getStatusVariant("PENDING")).toBe("outline");
    expect(getStatusVariant("FAILED")).toBe("destructive");
    expect(getStatusVariant("REFUNDED")).toBe("secondary");
  });

  it("humanizes payment method labels (every underscore)", () => {
    expect(getPaymentMethodLabel("MOBILE_MONEY")).toBe("MOBILE MONEY");
    expect(getPaymentMethodLabel("BANK_TRANSFER_INTL")).toBe(
      "BANK TRANSFER INTL"
    );
    expect(getPaymentMethodLabel("CASH")).toBe("CASH");
  });
});
