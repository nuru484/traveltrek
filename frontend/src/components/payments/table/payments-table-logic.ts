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
    // A customer cancelled a paid booking — money is waiting on an admin
    // refund. Rendered destructive so the row reads as "needs action".
    case "REFUND_REQUESTED":
      return "destructive";
    default:
      return "outline";
  }
};

/** "REFUND_REQUESTED" -> "REFUND REQUESTED" — the badge label for a status. */
export const getPaymentStatusLabel = (status: IPayment["status"]): string =>
  status.replace(/_/g, " ");

/** "MOBILE_MONEY" -> "MOBILE MONEY" — the human label for a payment method. */
export const getPaymentMethodLabel = (method: string) => {
  return method.replace(/_/g, " ");
};
