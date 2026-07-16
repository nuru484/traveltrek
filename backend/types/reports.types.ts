// types/reports.types.ts
import { IDestinationSummary } from './destination.types';

export interface IBookingSummary {
  bookingDate: Date;
  id: number;
  status: 'CANCELLED' | 'COMPLETED' | 'CONFIRMED' | 'PENDING';
  totalPrice: number;
  tour: ITourSummary | null;
  user: IUserSummary;
}

export interface IMonthlyBookingsResponse {
  data: {
    bookings: IBookingSummary[];
    monthlyBreakdown: {
      averageValue: number;
      bookingCount: number;
      month: string;
      revenue: number;
    }[];
    statusBreakdown: Record<
      'CANCELLED' | 'COMPLETED' | 'CONFIRMED' | 'PENDING',
      number
    >;
    summary: {
      averageBookingValue: number;
      period: {
        endDate: null | string;
        month: null | number;
        startDate: null | string;
        year: number;
      };
      totalBookings: number;
      totalRevenue: number;
    };
  };
  message: string;
}

export interface IPaymentsSummaryResponse {
  data: {
    methodBreakdown: Record<
      'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'MOBILE_MONEY',
      { amount: number; count: number }
    >;
    monthlyBreakdown: {
      count: number;
      month: string;
      revenue: number;
    }[];
    recentPayments: IPaymentSummary[];
    statusBreakdown: Record<
      'COMPLETED' | 'FAILED' | 'PENDING' | 'REFUNDED',
      { amount: number; count: number }
    >;
    summary: {
      currency: string;
      failedAmount: number;
      pendingAmount: number;
      period: {
        endDate: null | string;
        month: null | number;
        startDate: null | string;
        year: number;
      };
      refundedAmount: number;
      totalPayments: number;
      totalRevenue: number;
    };
  };
  message: string;
}

export interface IPaymentSummary {
  amount: number;
  booking: {
    id: number;
    totalPrice: number;
    tour: ITourSummary | null;
  };
  currency: string;
  id: number;
  paymentDate: Date | null;
  paymentMethod:
    | 'BANK_TRANSFER'
    | 'CREDIT_CARD'
    | 'DEBIT_CARD'
    | 'MOBILE_MONEY';
  status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'REFUNDED';
  transactionReference: null | string;
  user: IUserSummary;
}

export interface IReportsQueryParams {
  currency?: string;
  endDate?: string;
  limit?: number;
  minBookings?: number;
  month?: number;
  paymentMethod?:
    | 'BANK_TRANSFER'
    | 'CREDIT_CARD'
    | 'DEBIT_CARD'
    | 'MOBILE_MONEY';
  startDate?: string;
  status?: 'CANCELLED' | 'COMPLETED' | 'CONFIRMED' | 'PENDING';
  tourId?: number;
  tourStatus?: 'CANCELLED' | 'COMPLETED' | 'ONGOING' | 'UPCOMING';
  tourType?:
    | 'ADVENTURE'
    | 'BEACH'
    | 'CITY'
    | 'CRUISE'
    | 'CULTURAL'
    | 'WILDLIFE';
  userId?: number;
  year?: number;
}

export interface ITopToursResponse {
  data: {
    summary: {
      filters: {
        limit: number;
        minBookings: number;
        tourStatus: IReportsQueryParams['tourStatus'];
        tourType: IReportsQueryParams['tourType'];
      };
      period: {
        endDate: null | string;
        month: null | number;
        startDate: null | string;
        year: number;
      };
      totalBookingsAnalyzed: number;
      totalRevenueAnalyzed: number;
      totalToursAnalyzed: number;
    };
    topTours: ITourTopStats[];
  };
  message: string;
}

export interface ITourSummary {
  id: number;
  name: string;
}

export interface ITourTopStats {
  statistics: {
    confirmedBookings: number;
    totalBookings: number;
    totalRevenue: number;
  };
  tour: {
    description: null | string;
    destination: IDestinationSummary;
    duration: number;
    endDate: Date;
    id: number;
    maxGuests: number;
    name: string;
    price: number;
    startDate: Date;
    status: 'CANCELLED' | 'COMPLETED' | 'ONGOING' | 'UPCOMING';
    type: 'ADVENTURE' | 'BEACH' | 'CITY' | 'CRUISE' | 'CULTURAL' | 'WILDLIFE';
  };
}

export interface IUserSummary {
  email: string;
  id: number;
  name: string;
}
