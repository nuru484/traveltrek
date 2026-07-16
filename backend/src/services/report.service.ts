// src/services/report.service.ts
//
// Reports domain logic, extracted from the legacy fat controller. Pure, DI'd
// functions: they take the zod-validated query params, own every Prisma
// access and all aggregate math, and never touch req/res. Each returns the
// full legacy `data` payload so the thin controller only wraps it in the
// standard envelope — the wire shapes (aggregate keys, Math.round to 2dp,
// top-10 / top-N caps, sort orders, the `period` and `filters` echoes) are
// preserved bit-for-bit for the frontend dashboards.
//
// Legacy fidelity notes:
// - The period filter precedence is unchanged: an explicit startDate+endDate
//   range wins, then year+month, then the whole year. `year` defaults to the
//   current year (injected clock) exactly like the old destructure default,
//   so a date filter is ALWAYS applied.
// - `summary.period` echoes the raw startDate/endDate strings; when the
//   client sent none, the legacy `endDate!` serialized undefined — i.e. the
//   keys were simply absent from the JSON — so they stay optional here.
// - Report rows (bookings / recentPayments / topTours) are the raw Prisma
//   select shapes, serialized as-is; no mapper needed because the legacy
//   controller never reshaped them.
// - monthlyBreakdown bucket order follows first-appearance order of the rows
//   (legacy object-key insertion order), and recentPayments sorts by
//   paymentDate descending with null dates treated as epoch 0, as before.
import {
  type BookingStatus,
  type PaymentMethod,
  PaymentStatus,
  type Prisma,
  type TourStatus,
  type TourType,
} from '#config/prismaClient.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';

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

export type MonthlyBookingRow = Prisma.BookingGetPayload<{
  select: typeof monthlyBookingSelect;
}>;

export interface MonthlyBookingsParams extends ReportPeriodParams {
  status?: BookingStatus;
  tourId?: number;
  userId?: number;
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
  };
}

export interface PaymentMonthBucket {
  count: number;
  month: string;
  revenue: number;
}

export interface PaymentsSummaryParams extends ReportPeriodParams {
  /** Always present (zod defaults to GHS), so it always filters — as before. */
  currency: string;
  paymentMethod?: PaymentMethod;
  status?: PaymentStatus;
  userId?: number;
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
  };
}

export type PaymentSummaryRow = Prisma.PaymentGetPayload<{
  select: typeof paymentSummarySelect;
}>;

/**
 * The `summary.period` echo. startDate/endDate are the client's raw strings
 * and are omitted from the JSON when not sent (legacy behaviour).
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

const monthlyBookingSelect = {
  bookingDate: true,
  id: true,
  status: true,
  totalPrice: true,
  tour: {
    select: {
      id: true,
      name: true,
    },
  },
  user: {
    select: {
      email: true,
      id: true,
      name: true,
    },
  },
} satisfies Prisma.BookingSelect;

const paymentSummarySelect = {
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
  id: true,
  paymentDate: true,
  paymentMethod: true,
  status: true,
  transactionReference: true,
  user: {
    select: {
      email: true,
      id: true,
      name: true,
    },
  },
} satisfies Prisma.PaymentSelect;

const topTourBookingSelect = {
  bookingDate: true,
  id: true,
  status: true,
  totalPrice: true,
} satisfies Prisma.BookingSelect;

const topTourSelect = {
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

/**
 * The legacy date-window precedence: explicit range → year+month → whole
 * year. Month windows are built in server-local time and the range endpoints
 * with `new Date(string)`, exactly as the old handlers did.
 */
const periodClause = (
  params: ReportPeriodParams,
  year: number,
): Prisma.DateTimeFilter => {
  if (params.startDate && params.endDate) {
    return {
      gte: new Date(params.startDate),
      lte: new Date(params.endDate),
    };
  }

  if (params.month) {
    return {
      gte: new Date(year, params.month - 1, 1),
      lte: new Date(year, params.month, 0, 23, 59, 59),
    };
  }

  return {
    gte: new Date(year, 0, 1),
    lte: new Date(year, 11, 31, 23, 59, 59),
  };
};

const periodEcho = (
  params: ReportPeriodParams,
  year: number,
): ReportPeriod => ({
  endDate: params.endDate,
  month: params.month ?? null,
  startDate: params.startDate,
  year,
});

export const makeReportService = (d: Pick<AppDeps, 'clock' | 'prisma'>) => {
  const { clock, prisma } = d;

  const resolveYear = (year?: number): number =>
    year ?? clock.now().getFullYear();

  /** GET /reports/bookings/monthly-summary — first 10 rows + aggregates. */
  const getMonthlyBookingsSummary = async (
    params: MonthlyBookingsParams,
  ): Promise<MonthlyBookingsReport> => {
    const year = resolveYear(params.year);

    const where: Prisma.BookingWhereInput = {
      bookingDate: periodClause(params, year),
    };
    if (params.tourId) where.tourId = params.tourId;
    if (params.userId) where.userId = params.userId;
    if (params.status) where.status = params.status;

    const bookings = await prisma.booking.findMany({
      select: monthlyBookingSelect,
      where,
    });

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce(
      (sum, booking) => sum + booking.totalPrice,
      0,
    );
    const averageBookingValue =
      totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Buckets keyed by "YYYY-MM", in first-appearance order (legacy object
    // insertion order).
    const monthlyBuckets = new Map<string, BookingMonthBucket>();
    const statusBreakdown: Partial<Record<BookingStatus, number>> = {};

    for (const booking of bookings) {
      const monthKey = booking.bookingDate.toISOString().slice(0, 7);
      let bucket = monthlyBuckets.get(monthKey);
      if (!bucket) {
        bucket = {
          averageValue: 0,
          bookingCount: 0,
          month: monthKey,
          revenue: 0,
        };
        monthlyBuckets.set(monthKey, bucket);
      }
      bucket.bookingCount += 1;
      bucket.revenue += booking.totalPrice;
      bucket.averageValue = bucket.revenue / bucket.bookingCount;

      statusBreakdown[booking.status] =
        (statusBreakdown[booking.status] ?? 0) + 1;
    }

    return {
      bookings: bookings.slice(0, 10),
      monthlyBreakdown: [...monthlyBuckets.values()],
      statusBreakdown,
      summary: {
        averageBookingValue: Math.round(averageBookingValue * 100) / 100,
        period: periodEcho(params, year),
        totalBookings,
        totalRevenue,
      },
    };
  };

  /** GET /reports/payments/summary — 10 most recent rows + aggregates. */
  const getPaymentsSummary = async (
    params: PaymentsSummaryParams,
  ): Promise<PaymentsSummaryReport> => {
    const year = resolveYear(params.year);

    const where: Prisma.PaymentWhereInput = {
      currency: params.currency,
      paymentDate: periodClause(params, year),
    };
    if (params.paymentMethod) where.paymentMethod = params.paymentMethod;
    if (params.status) where.status = params.status;
    if (params.userId) where.userId = params.userId;

    const payments = await prisma.payment.findMany({
      select: paymentSummarySelect,
      where,
    });

    const sumWhere = (status: PaymentStatus): number =>
      payments
        .filter((p) => p.status === status)
        .reduce((sum, payment) => sum + payment.amount, 0);

    const statusBreakdown: Partial<
      Record<PaymentStatus, AmountCountBucket>
    > = {};
    const methodBreakdown: Partial<
      Record<PaymentMethod, AmountCountBucket>
    > = {};
    const monthlyBuckets = new Map<string, PaymentMonthBucket>();

    for (const payment of payments) {
      const statusBucket = (statusBreakdown[payment.status] ??= {
        amount: 0,
        count: 0,
      });
      statusBucket.count += 1;
      statusBucket.amount += payment.amount;

      const methodBucket = (methodBreakdown[payment.paymentMethod] ??= {
        amount: 0,
        count: 0,
      });
      methodBucket.count += 1;
      methodBucket.amount += payment.amount;

      // Monthly buckets count every dated payment but only COMPLETED ones
      // contribute revenue; undated payments are skipped entirely.
      if (!payment.paymentDate) continue;
      const monthKey = payment.paymentDate.toISOString().slice(0, 7);
      let monthBucket = monthlyBuckets.get(monthKey);
      if (!monthBucket) {
        monthBucket = { count: 0, month: monthKey, revenue: 0 };
        monthlyBuckets.set(monthKey, monthBucket);
      }
      monthBucket.count += 1;
      if (payment.status === PaymentStatus.COMPLETED) {
        monthBucket.revenue += payment.amount;
      }
    }

    return {
      methodBreakdown,
      monthlyBreakdown: [...monthlyBuckets.values()],
      recentPayments: [...payments]
        .sort(
          (a, b) =>
            (b.paymentDate?.getTime() ?? 0) - (a.paymentDate?.getTime() ?? 0),
        )
        .slice(0, 10),
      statusBreakdown,
      summary: {
        currency: params.currency,
        failedAmount: sumWhere(PaymentStatus.FAILED),
        pendingAmount: sumWhere(PaymentStatus.PENDING),
        period: periodEcho(params, year),
        refundedAmount: sumWhere(PaymentStatus.REFUNDED),
        totalPayments: payments.length,
        totalRevenue: sumWhere(PaymentStatus.COMPLETED),
      },
    };
  };

  /**
   * GET /reports/tours/top-by-bookings — every matching tour is analyzed
   * (the summary totals cover all of them); the topTours list keeps those
   * with >= minBookings period bookings, sorted by booking count descending,
   * capped at `limit`.
   */
  const getTopToursByBookings = async (
    params: TopToursParams,
  ): Promise<TopToursReport> => {
    const year = resolveYear(params.year);

    const tourWhere: Prisma.TourWhereInput = {};
    if (params.tourType) tourWhere.type = params.tourType;
    if (params.tourStatus) tourWhere.status = params.tourStatus;

    const toursWithBookings = await prisma.tour.findMany({
      select: {
        ...topTourSelect,
        bookings: {
          select: topTourBookingSelect,
          // Nested reads are not auto-scoped; skip soft-deleted bookings.
          where: { bookingDate: periodClause(params, year), deletedAt: null },
        },
      },
      where: tourWhere,
    });

    const topTours: TourTopStats[] = toursWithBookings
      .map(({ bookings, ...tour }) => ({
        statistics: {
          confirmedBookings: bookings.filter((b) => b.status === 'CONFIRMED')
            .length,
          totalBookings: bookings.length,
          totalRevenue: bookings.reduce(
            (sum, booking) => sum + booking.totalPrice,
            0,
          ),
        },
        tour,
      }))
      .filter(
        (tourStat) => tourStat.statistics.totalBookings >= params.minBookings,
      )
      .sort((a, b) => b.statistics.totalBookings - a.statistics.totalBookings)
      .slice(0, params.limit);

    return {
      summary: {
        filters: {
          limit: params.limit,
          minBookings: params.minBookings,
          tourStatus: params.tourStatus,
          tourType: params.tourType,
        },
        period: periodEcho(params, year),
        totalBookingsAnalyzed: toursWithBookings.reduce(
          (sum, tour) => sum + tour.bookings.length,
          0,
        ),
        totalRevenueAnalyzed: toursWithBookings.reduce(
          (sum, tour) =>
            sum +
            tour.bookings.reduce(
              (bookingSum, booking) => bookingSum + booking.totalPrice,
              0,
            ),
          0,
        ),
        totalToursAnalyzed: toursWithBookings.length,
      },
      topTours,
    };
  };

  return {
    getMonthlyBookingsSummary,
    getPaymentsSummary,
    getTopToursByBookings,
  };
};

export const reportService = makeReportService(defaultDeps);

export const {
  getMonthlyBookingsSummary,
  getPaymentsSummary,
  getTopToursByBookings,
} = reportService;
