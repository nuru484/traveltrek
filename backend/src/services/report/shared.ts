// src/services/report/shared.ts
//
// Dependency-free building blocks for the reports domain: the Prisma select
// shapes, the wire-payload types the dashboards consume, and the pure
// period-window / trend helpers. Shared by every report module.
import {
  type BookingStatus,
  type PaymentMethod,
  type PaymentStatus,
  type Prisma,
  type TourStatus,
  type TourType,
} from '#config/prismaClient.js';
import { type AppDeps } from '#services/deps.js';
import {
  type BookingWithRelations,
} from '#utils/mappers/booking.mapper.js';

/** The deps the reports domain draws from the app container. */
export type ReportDeps = Pick<AppDeps, 'clock' | 'prisma'>;

// ---- Prisma select shapes (rows go out unreshaped) ----

export const monthlyBookingSelect = {
  bookingDate: true,
  customer: {
    select: {
      email: true,
      id: true,
      name: true,
    },
  },
  id: true,
  status: true,
  totalPrice: true,
  tour: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.BookingSelect;

export const paymentSummarySelect = {
  amount: true,
  booking: {
    select: {
      id: true,
      totalPrice: true,
      tour: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  currency: true,
  customer: {
    select: {
      email: true,
      id: true,
      name: true,
    },
  },
  id: true,
  paymentDate: true,
  paymentMethod: true,
  status: true,
  transactionReference: true,
} satisfies Prisma.PaymentSelect;

export const topTourBookingSelect = {
  bookingDate: true,
  id: true,
  status: true,
  totalPrice: true,
} satisfies Prisma.BookingSelect;

export const topTourSelect = {
  bookings: { select: topTourBookingSelect },
  description: true,
  destination: {
    select: {
      city: true,
      country: true,
      id: true,
      name: true,
    },
  },
  duration: true,
  endDate: true,
  id: true,
  maxGuests: true,
  name: true,
  price: true,
  startDate: true,
  status: true,
  type: true,
} satisfies Prisma.TourSelect;

export interface AgentActivityParams extends ReportPeriodParams {
  /** ADMIN only: view another staff member's activity. */
  userId?: number;
}

// ---- Wire-payload types ----

/** GET /reports/agent-activity — a staff member's recorded-booking activity
 * (scoped via Booking.createdByUserId). */
export interface AgentActivityReport {
  /** Zero-filled month buckets spanning the period (12 for a year window):
   * bookings recorded that month + COMPLETED-payment revenue from them. */
  monthly: { bookings: number; month: string; revenue: number }[];
  recentBookings: BookingWithRelations[];
  summary: {
    bookingsRecorded: number;
    /** Distinct customers among the recorded bookings. */
    customersServed: number;
    /** Pipeline value: totalPrice of recorded bookings still PENDING. */
    pendingFromRecorded: number;
    period: ReportPeriod;
    /** COMPLETED payments of the recorded bookings. */
    revenueFromRecorded: number;
  };
}

/** {amount, count} bucket used by the payment status/method breakdowns. */
export interface AmountCountBucket {
  amount: number;
  count: number;
}

export interface BookingMonthBucket {
  averageValue: number;
  bookingCount: number;
  month: string;
  revenue: number;
}

/** GET /reports/me — the authenticated customer's own travel activity. */
export interface CustomerSelfReport {
  /** Booking count + totalPrice value per booked-item type in the period. */
  byType: Partial<Record<'FLIGHT' | 'ROOM' | 'TOUR', AmountCountBucket>>;
  /** Zero-filled month buckets spanning the period (12 for a year window):
   * COMPLETED-payment spend + bookings made that month. */
  monthlySpend: { amount: number; bookings: number; month: string }[];
  recentBookings: BookingWithRelations[];
  summary: {
    /** Average booking totalPrice over the period's bookings (2dp). */
    averageBookingValue: number;
    cancelledBookings: number;
    period: ReportPeriod;
    /** COMPLETED payments in the period. */
    totalSpent: number;
    /** COMPLETED bookings in the period. */
    totalTrips: number;
    /** PENDING/CONFIRMED bookings whose trip start is still ahead. */
    upcomingTrips: number;
  };
}

export type MonthlyBookingRow = Prisma.BookingGetPayload<{
  select: typeof monthlyBookingSelect;
}>;

export interface MonthlyBookingsParams extends ReportPeriodParams {
  customerId?: number;
  status?: BookingStatus;
  tourId?: number;
}

export interface MonthlyBookingsReport {
  bookings: MonthlyBookingRow[];
  monthlyBreakdown: BookingMonthBucket[];
  statusBreakdown: Partial<Record<BookingStatus, number>>;
  summary: {
    averageBookingValue: number;
    period: ReportPeriod;
    totalBookings: number;
    totalRevenue: number;
    /** Additive: per-KPI change vs the equal-length previous window. */
    trends: {
      averageBookingValue: ReportTrend;
      totalBookings: ReportTrend;
      totalRevenue: ReportTrend;
    };
  };
}

export interface PaymentMonthBucket {
  count: number;
  month: string;
  revenue: number;
}

export interface PaymentsSummaryParams extends ReportPeriodParams {
  /** Always present (zod defaults to GHS), so it always filters. */
  currency: string;
  customerId?: number;
  paymentMethod?: PaymentMethod;
  status?: PaymentStatus;
}

export interface PaymentsSummaryReport {
  methodBreakdown: Partial<Record<PaymentMethod, AmountCountBucket>>;
  monthlyBreakdown: PaymentMonthBucket[];
  recentPayments: PaymentSummaryRow[];
  statusBreakdown: Partial<Record<PaymentStatus, AmountCountBucket>>;
  summary: {
    currency: string;
    failedAmount: number;
    pendingAmount: number;
    period: ReportPeriod;
    refundedAmount: number;
    totalPayments: number;
    totalRevenue: number;
    /** Additive: per-KPI change vs the equal-length previous window. */
    trends: {
      failedAmount: ReportTrend;
      pendingAmount: ReportTrend;
      refundedAmount: ReportTrend;
      totalPayments: ReportTrend;
      totalRevenue: ReportTrend;
    };
  };
}

export type PaymentSummaryRow = Prisma.PaymentGetPayload<{
  select: typeof paymentSummarySelect;
}>;

/** Resolved report window: concrete start/end instants. */
export interface PeriodWindow {
  end: Date;
  start: Date;
}

/**
 * The `summary.period` echo. startDate/endDate are the client's raw strings
 * and are omitted from the JSON when not sent.
 */
export interface ReportPeriod {
  endDate?: string;
  month: null | number;
  startDate?: string;
  year: number;
}

export interface ReportPeriodParams {
  endDate?: string;
  month?: number;
  startDate?: string;
  year?: number;
}

/**
 * Per-KPI trend vs the equal-length previous window. `percentage` is the
 * absolute change (2dp); `direction` carries the sign.
 */
export interface ReportTrend {
  direction: 'down' | 'flat' | 'up';
  percentage: number;
}

export interface TopToursParams extends ReportPeriodParams {
  limit: number;
  minBookings: number;
  tourStatus?: TourStatus;
  tourType?: TourType;
}

export interface TopToursReport {
  summary: {
    filters: {
      limit: number;
      minBookings: number;
      tourStatus?: TourStatus;
      tourType?: TourType;
    };
    period: ReportPeriod;
    totalBookingsAnalyzed: number;
    totalRevenueAnalyzed: number;
    totalToursAnalyzed: number;
  };
  topTours: TourTopStats[];
}

export interface TourTopStats {
  statistics: {
    confirmedBookings: number;
    totalBookings: number;
    totalRevenue: number;
  };
  tour: Omit<TopTourRow, 'bookings'>;
}

type TopTourRow = Prisma.TourGetPayload<{ select: typeof topTourSelect }>;

// ---- Pure period / trend helpers ----

/**
 * The trend math: if the previous window has no activity, any current
 * activity reads as +100% up; otherwise the percentage
 * is the absolute change rounded to 2dp with the sign in `direction`.
 */
export const calculateTrend = (
  current: number,
  previous: number,
): ReportTrend => {
  if (previous === 0) {
    return {
      direction: current > 0 ? 'up' : 'flat',
      percentage: current > 0 ? 100 : 0,
    };
  }

  const change = ((current - previous) / previous) * 100;

  return {
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    percentage: Math.abs(Math.round(change * 100) / 100),
  };
};

/**
 * Date-window precedence: explicit range → year+month → whole year. Month
 * windows are built in server-local time, the range endpoints with
 * `new Date(string)`.
 */
export const periodWindow = (
  params: ReportPeriodParams,
  year: number,
): PeriodWindow => {
  if (params.startDate && params.endDate) {
    return {
      end: new Date(params.endDate),
      start: new Date(params.startDate),
    };
  }

  if (params.month) {
    return {
      end: new Date(year, params.month, 0, 23, 59, 59),
      start: new Date(year, params.month - 1, 1),
    };
  }

  return {
    end: new Date(year, 11, 31, 23, 59, 59),
    start: new Date(year, 0, 1),
  };
};

/**
 * The equal-length window immediately before `window`: ends 1ms before the
 * current start.
 */
export const previousWindow = (window: PeriodWindow): PeriodWindow => {
  const end = new Date(window.start.getTime() - 1);
  return {
    end,
    start: new Date(
      end.getTime() - (window.end.getTime() - window.start.getTime()),
    ),
  };
};

export const windowClause = (window: PeriodWindow): Prisma.DateTimeFilter => ({
  gte: window.start,
  lte: window.end,
});

/**
 * Every "YYYY-MM" key the window spans (UTC months, matching the
 * toISOString-based bucket keys used across the reports) — the zero-filled
 * bucket skeleton for the self reports: 12 buckets for a year window, one
 * per month of a custom range.
 */
export const monthKeysBetween = (window: PeriodWindow): string[] => {
  const keys: string[] = [];
  let year = window.start.getUTCFullYear();
  let month = window.start.getUTCMonth();
  const endYear = window.end.getUTCFullYear();
  const endMonth = window.end.getUTCMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month + 1).padStart(2, '0')}`);
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return keys;
};

export const periodEcho = (
  params: ReportPeriodParams,
  year: number,
): ReportPeriod => ({
  endDate: params.endDate,
  month: params.month ?? null,
  startDate: params.startDate,
  year,
});
