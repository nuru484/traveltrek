// NOTE: every money field in these report shapes (totalPrice, amount,
// price, revenue, totalRevenue, *Amount, totalRevenueAnalyzed,
// averageBookingValue, averageValue) is integer minor units (pesewas):
// GH₵ 1.00 = 100. Averages may carry 2-dp fractions of a pesewa.
// types/reports.types.ts
import { IDestinationSummary } from "./tour.types";

/**
 * Per-KPI change vs the equal-length previous window. Mirrors the backend
 * `ReportTrend` (services/report.service.ts): `percentage` is the absolute
 * change (2dp); `direction` carries the sign.
 */
export interface ITrend {
  direction: "up" | "down" | "flat";
  percentage: number;
}

/**
 * One slice of a breakdown chart, derived client-side from the backend's
 * Partial<Record<..., count | {count, amount}>> breakdown maps. `amount` is
 * integer pesewas.
 */
export interface IBreakdownSegment {
  key: string;
  count: number;
  amount: number;
  percentage: number;
}

/** Customer summary embedded in report rows (nullable email column). */
export interface ICustomerSummary {
  id: number;
  name: string;
  email: string | null;
}

export interface ITourSummary {
  id: number;
  name: string;
}

export interface IBookingSummary {
  id: number;
  totalPrice: number;
  bookingDate: Date;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  tour: ITourSummary | null;
  customer: ICustomerSummary;
}

export interface IPaymentSummary {
  id: number;
  amount: number;
  currency: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  paymentMethod:
    | "CREDIT_CARD"
    | "DEBIT_CARD"
    | "MOBILE_MONEY"
    | "BANK_TRANSFER";
  paymentDate: Date | null;
  transactionReference: string | null;
  customer: ICustomerSummary;
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
    type: "ADVENTURE" | "CULTURAL" | "BEACH" | "CITY" | "WILDLIFE" | "CRUISE";
    status: "UPCOMING" | "ONGOING" | "COMPLETED" | "CANCELLED";
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
  };
}

export interface IReportsQueryParams {
  year?: number;
  month?: number;
  startDate?: string;
  endDate?: string;
  tourId?: number;
  customerId?: number;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  paymentMethod?:
    | "CREDIT_CARD"
    | "DEBIT_CARD"
    | "MOBILE_MONEY"
    | "BANK_TRANSFER";
  currency?: string;
  tourType?:
    | "ADVENTURE"
    | "CULTURAL"
    | "BEACH"
    | "CITY"
    | "WILDLIFE"
    | "CRUISE";
  tourStatus?: "UPCOMING" | "ONGOING" | "COMPLETED" | "CANCELLED";
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
      trends: {
        totalBookings: ITrend;
        totalRevenue: ITrend;
        averageBookingValue: ITrend;
      };
    };
    monthlyBreakdown: Array<{
      month: string;
      bookingCount: number;
      revenue: number;
      averageValue: number;
    }>;
    /** Only statuses that occurred are present (backend Partial<Record>). */
    statusBreakdown: Partial<
      Record<"PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED", number>
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
      trends: {
        totalPayments: ITrend;
        totalRevenue: ITrend;
        pendingAmount: ITrend;
        failedAmount: ITrend;
        refundedAmount: ITrend;
      };
    };
    /** Only statuses/methods that occurred are present (backend Partial<Record>). */
    statusBreakdown: Partial<
      Record<
        "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED",
        { count: number; amount: number }
      >
    >;
    methodBreakdown: Partial<
      Record<
        "CREDIT_CARD" | "DEBIT_CARD" | "MOBILE_MONEY" | "BANK_TRANSFER",
        { count: number; amount: number }
      >
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
        tourType: IReportsQueryParams["tourType"];
        tourStatus: IReportsQueryParams["tourStatus"];
        minBookings: number;
        limit: number;
      };
    };
    topTours: ITourTopStats[];
  };
}
