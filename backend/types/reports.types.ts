// types/reports.types.ts
import { IDestinationSummary } from './destination.types';

export interface IUserSummary {
  id: number;
  name: string;
  email: string;
}

export interface ITourSummary {
  id: number;
  name: string;
}

export interface IBookingSummary {
  id: number;
  totalPrice: number;
  bookingDate: Date;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  tour: ITourSummary | null;
  user: IUserSummary;
}

export interface IPaymentSummary {
  id: number;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod:
    | 'CREDIT_CARD'
    | 'DEBIT_CARD'
    | 'MOBILE_MONEY'
    | 'BANK_TRANSFER';
  paymentDate: Date | null;
  transactionReference: string | null;
  user: IUserSummary;
  booking: {
    id: number;
    totalPrice: number;
    tour: ITourSummary | null;
  };
}

export interface ITourTopStats {
  tour: {
    id: number;
    name: string;
    description: string | null;
    type: 'ADVENTURE' | 'CULTURAL' | 'BEACH' | 'CITY' | 'WILDLIFE' | 'CRUISE';
    status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
    price: number;
    duration: number;
    destination: IDestinationSummary;
    startDate: Date;
    endDate: Date;
    maxGuests: number;
  };
  statistics: {
    totalBookings: number;
    confirmedBookings: number;
    totalRevenue: number;
    averageRating: number;
    reviewCount: number;
  };
}

export interface IReportsQueryParams {
  year?: number;
  month?: number;
  startDate?: string;
  endDate?: string;
  tourId?: number;
  userId?: number;
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  paymentMethod?:
    | 'CREDIT_CARD'
    | 'DEBIT_CARD'
    | 'MOBILE_MONEY'
    | 'BANK_TRANSFER';
  currency?: string;
  tourType?:
    | 'ADVENTURE'
    | 'CULTURAL'
    | 'BEACH'
    | 'CITY'
    | 'WILDLIFE'
    | 'CRUISE';
  tourStatus?: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  limit?: number;
  minBookings?: number;
}

export interface IMonthlyBookingsResponse {
  message: string;
  data: {
    summary: {
      totalBookings: number;
      totalRevenue: number;
      averageBookingValue: number;
      period: {
        year: number;
        month: number | null;
        startDate: string | null;
        endDate: string | null;
      };
    };
    monthlyBreakdown: Array<{
      month: string;
      bookingCount: number;
      revenue: number;
      averageValue: number;
    }>;
    statusBreakdown: Record<
      'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
      number
    >;
    bookings: IBookingSummary[];
  };
}

export interface IPaymentsSummaryResponse {
  message: string;
  data: {
    summary: {
      totalPayments: number;
      totalRevenue: number;
      pendingAmount: number;
      failedAmount: number;
      refundedAmount: number;
      currency: string;
      period: {
        year: number;
        month: number | null;
        startDate: string | null;
        endDate: string | null;
      };
    };
    statusBreakdown: Record<
      'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED',
      { count: number; amount: number }
    >;
    methodBreakdown: Record<
      'CREDIT_CARD' | 'DEBIT_CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER',
      { count: number; amount: number }
    >;
    monthlyBreakdown: Array<{
      month: string;
      count: number;
      revenue: number;
    }>;
    recentPayments: IPaymentSummary[];
  };
}

export interface ITopToursResponse {
  message: string;
  data: {
    summary: {
      totalToursAnalyzed: number;
      totalBookingsAnalyzed: number;
      totalRevenueAnalyzed: number;
      period: {
        year: number;
        month: number | null;
        startDate: string | null;
        endDate: string | null;
      };
      filters: {
        tourType: IReportsQueryParams['tourType'];
        tourStatus: IReportsQueryParams['tourStatus'];
        minBookings: number;
        limit: number;
      };
    };
    topTours: ITourTopStats[];
  };
}
