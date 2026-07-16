export interface IBookedItem {
  description: null | string;
  id: number;
  name: string;
  type: 'FLIGHT' | 'HOTEL' | 'ROOM' | 'TOUR';
}

export interface IDeleteAllPaymentsParams {
  beforeDate?: string;
  paymentMethod?: IPaymentMethod;
  status?: 'FAILED' | 'PENDING' | 'REFUNDED';
  userId?: number;
}

export interface IDeleteAllPaymentsResponse {
  data: {
    bookingsAffected: number;
    deletedCount: number;
  };
  message: string;
}

export interface IDeletePaymentResponse {
  data: {
    bookingId: number;
    paymentId: number;
  };
  message: string;
}

export interface IPayment {
  amount: number;
  bookedItem: IBookedItem;
  bookingId: number;
  createdAt: Date;
  currency: string;
  id: number;
  paymentDate: Date | null;
  paymentMethod: string;
  status: IPaymentStatus;
  transactionReference: string;
  updatedAt: Date;
  user: IPaymentUser;
  userId: number;
}

export interface IPaymentInitializeResponse {
  data: {
    authorization_url: string;
    paymentId: number;
    transactionReference: string;
  };
  message: string;
}

export interface IPaymentInput {
  bookingId: number;
  paymentMethod: IPaymentMethod;
}

export type IPaymentMethod =
  | 'BANK_TRANSFER'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'MOBILE_MONEY';

export interface IPaymentResponse {
  data: IPayment;
  message: string;
}

export interface IPaymentsPaginatedResponse {
  data: IPayment[];
  message: string;
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
}

export interface IPaymentsQueryParams {
  bookingType?: 'FLIGHT' | 'HOTEL' | 'ROOM' | 'TOUR';
  limit?: number;
  page?: number;
  paymentMethod?: IPaymentMethod;
  search?: string;
  status?: IPaymentStatus;
  userId?: number;
}

export type IPaymentStatus = 'COMPLETED' | 'FAILED' | 'PENDING' | 'REFUNDED';

export interface IPaymentUser {
  email: string;
  id: number;
  name: string;
}

export interface IPaymentVerificationResponse {
  data?: {
    amount: number;
    bookingId: number;
    paymentStatus: IPaymentStatus;
    reference: string;
  };
  message: string;
  success: boolean;
}

export interface IRefundPaymentInput {
  reason?: string;
}

export interface IRefundPaymentResponse {
  data: {
    bookingStatus: string;
    paymentId: number;
    reason: string;
    refundAmount: number;
    status: IPaymentStatus;
    updatedAt: Date;
  };
  message: string;
}

export interface IUpdatePaymentStatusInput {
  status: IPaymentStatus;
}

export interface IUpdatePaymentStatusResponse {
  data: {
    bookingStatus: string;
    paymentId: number;
    status: IPaymentStatus;
    updatedAt: Date;
  };
  message: string;
}
