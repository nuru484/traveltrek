export interface IPaymentInput {
  bookingId: number;
  paymentMethod: IPaymentMethod;
}

export type IPaymentMethod =
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'MOBILE_MONEY'
  | 'BANK_TRANSFER';

export type IPaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface IBookedItem {
  id: number;
  name: string;
  description: string | null;
  type: 'TOUR' | 'HOTEL' | 'ROOM' | 'FLIGHT';
}

export interface IPaymentUser {
  id: number;
  name: string;
  email: string;
}

export interface IPayment {
  id: number;
  bookingId: number;
  userId: number;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: IPaymentStatus;
  transactionReference: string;
  paymentDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  bookedItem: IBookedItem;
  user: IPaymentUser;
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
    amount: number;
    reference: string;
    paymentStatus: IPaymentStatus;
    bookingId: number;
  };
}

// New interfaces for update, delete, and refund operations
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
  status?: 'PENDING' | 'FAILED' | 'REFUNDED';
  paymentMethod?: IPaymentMethod;
  userId?: number;
  beforeDate?: string;
}

export interface IDeleteAllPaymentsResponse {
  message: string;
  data: {
    deletedCount: number;
    bookingsAffected: number[];
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
  userId?: number;
  bookingType?: 'TOUR' | 'HOTEL' | 'ROOM' | 'FLIGHT';
  search?: string;
}
