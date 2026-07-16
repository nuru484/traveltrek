// src/types/payment.types.ts

export type IPaymentMethod =
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "MOBILE_MONEY"
  | "BANK_TRANSFER";

export type IPaymentStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED"
  /** Set only by customer self-cancel of a paid booking; leaves via refund. */
  | "REFUND_REQUESTED";

export interface IPaymentInput {
  bookingId: number;
  paymentMethod: IPaymentMethod;
}

export interface IBookedItem {
  id: number;
  name: string;
  description: string | null;
  type: "TOUR" | "HOTEL" | "ROOM" | "FLIGHT";
}

/** Customer summary embedded in a payment (backend paymentInclude.customer). */
export interface IPaymentCustomer {
  id: number;
  name: string;
  /** Nullable column — phone-only customers have no email. */
  email: string | null;
}

export interface IPayment {
  id: number;
  bookingId: number;
  customerId: number;
  /** Integer minor units (pesewas): GH₵ 1.00 = 100. */
  amount: number;
  currency: string;
  paymentMethod: string;
  status: IPaymentStatus;
  transactionReference: string;
  paymentDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  bookedItem: IBookedItem;
  customer: IPaymentCustomer;
}

export interface IPaymentsPaginatedResponse {
  message: string;
  data: IPayment[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IPaymentResponse {
  message: string;
  data: IPayment;
}

export interface IPaymentInitializeResponse {
  message: string;
  data: {
    authorization_url: string;
    paymentId: number;
    transactionReference: string;
  };
}

export interface IPaymentVerificationResponse {
  success: boolean;
  message: string;
  data?: {
    /** Integer minor units (pesewas): GH₵ 1.00 = 100. */
    amount: number;
    reference: string;
    paymentStatus: IPaymentStatus;
    bookingId: number;
  };
}

export interface IUpdatePaymentStatusInput {
  status: IPaymentStatus;
}

export interface IUpdatePaymentStatusResponse {
  message: string;
  data: {
    paymentId: number;
    status: IPaymentStatus;
    bookingStatus: string;
    updatedAt: Date;
  };
}

export interface IDeletePaymentResponse {
  message: string;
  data: {
    paymentId: number;
    bookingId: number;
  };
}

export interface IDeleteAllPaymentsParams {
  status?: "PENDING" | "FAILED" | "REFUNDED";
  paymentMethod?: IPaymentMethod;
  customerId?: number;
  beforeDate?: string;
}

/** DELETE /payments (admin bulk wipe) — no filters; counts only. */
export interface IDeleteAllPaymentsResponse {
  message: string;
  data: {
    deletedCount: number;
    bookingsAffected: number;
  };
}

export interface IRefundPaymentInput {
  reason?: string;
}

export interface IRefundPaymentResponse {
  message: string;
  data: {
    paymentId: number;
    status: IPaymentStatus;
    bookingStatus: string;
    /** Integer minor units (pesewas): GH₵ 1.00 = 100. */
    refundAmount: number;
    reason: string;
    updatedAt: Date;
  };
}

export interface IPaymentsQueryParams {
  page?: number;
  limit?: number;
  status?: IPaymentStatus;
  paymentMethod?: IPaymentMethod;
  customerId?: number;
  search?: string;
  bookingId?: number;
}

export interface IPaymentsDataTableProps {
  data: IPayment[];
  loading?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  filters: Omit<IPaymentsQueryParams, "page" | "limit">;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onFiltersChange: (
    filters: Partial<Omit<IPaymentsQueryParams, "page" | "limit">>
  ) => void;
  onRefresh?: () => void;
  showUser?: boolean;
  showBooking?: boolean;
}
