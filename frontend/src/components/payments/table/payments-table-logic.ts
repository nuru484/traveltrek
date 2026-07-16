// src/components/payments/table/payments-table-logic.ts
//
// Pure display helpers shared by the desktop columns and the mobile row
// cards, extracted so both halves render a payment identically.
import { IPayment } from "@/types/payment.types";

export const getStatusVariant = (status: IPayment["status"]) => {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "PENDING":
      return "outline";
    case "FAILED":
      return "destructive";
    case "REFUNDED":
      return "secondary";
    default:
      return "outline";
  }
};

/** "MOBILE_MONEY" -> "MOBILE MONEY" — the human label for a payment method. */
export const getPaymentMethodLabel = (method: string) => {
  return method.replace(/_/g, " ");
};
