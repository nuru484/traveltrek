// src/components/reports/report-data.ts
//
// Pure helpers turning the reports API's breakdown maps into the ordered
// segment/point arrays the chart primitives render. Kept free of React so
// they're unit-testable. All amounts are integer pesewas.
import {
  IAgentActivityResponse,
  IBreakdownSegment,
  IBookingSummary,
  ICustomerSelfReportResponse,
  IMonthlyBookingsResponse,
  IPaymentsSummaryResponse,
} from "@/types/reports.types";
import type { IBooking } from "@/types/booking.types";
import type { TrendPoint } from "./report-charts";

const pct = (value: number, total: number): number =>
  total > 0 ? Math.round((value / total) * 1000) / 10 : 0;

/** "2026-03" → "Mar 2026". */
export const monthLabel = (month: string): string => {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

/**
 * Booking statuses arrive as bare counts — the segments are count-valued
 * (`amount` carries the count; render with valueKind="count").
 */
export function bookingStatusSegments(
  statusBreakdown: IMonthlyBookingsResponse["data"]["statusBreakdown"],
): IBreakdownSegment[] {
  const entries = Object.entries(statusBreakdown) as Array<[string, number]>;
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return entries.map(([key, count]) => ({
    key,
    count,
    amount: count,
    percentage: pct(count, total),
  }));
}

type AmountCountMap = Partial<Record<string, { count: number; amount: number }>>;

const amountSegments = (map: AmountCountMap): IBreakdownSegment[] => {
  const entries = Object.entries(map).filter(
    (entry): entry is [string, { count: number; amount: number }] =>
      entry[1] !== undefined,
  );
  const total = entries.reduce((sum, [, bucket]) => sum + bucket.amount, 0);
  return entries.map(([key, bucket]) => ({
    key,
    count: bucket.count,
    amount: bucket.amount,
    percentage: pct(bucket.amount, total),
  }));
};

export function paymentStatusSegments(
  statusBreakdown: IPaymentsSummaryResponse["data"]["statusBreakdown"],
): IBreakdownSegment[] {
  return amountSegments(statusBreakdown);
}

export function paymentMethodSegments(
  methodBreakdown: IPaymentsSummaryResponse["data"]["methodBreakdown"],
): IBreakdownSegment[] {
  return amountSegments(methodBreakdown);
}

export function bookingsTrendPoints(
  monthlyBreakdown: IMonthlyBookingsResponse["data"]["monthlyBreakdown"],
): TrendPoint[] {
  return [...monthlyBreakdown]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((bucket) => ({
      period: monthLabel(bucket.month),
      amount: bucket.revenue,
      count: bucket.bookingCount,
    }));
}

/** GET /reports/me monthlySpend → spend-over-time points. */
export function selfSpendTrendPoints(
  monthlySpend: ICustomerSelfReportResponse["data"]["monthlySpend"],
): TrendPoint[] {
  return [...monthlySpend]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((bucket) => ({
      period: monthLabel(bucket.month),
      amount: bucket.amount,
      count: bucket.bookings,
    }));
}

/** GET /reports/me byType → money-valued segments (TOUR/ROOM/FLIGHT). */
export function selfByTypeSegments(
  byType: ICustomerSelfReportResponse["data"]["byType"],
): IBreakdownSegment[] {
  return amountSegments(byType);
}

/** GET /reports/agent-activity monthly → recorded-revenue points. */
export function agentActivityTrendPoints(
  monthly: IAgentActivityResponse["data"]["monthly"],
): TrendPoint[] {
  return [...monthly]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((bucket) => ({
      period: monthLabel(bucket.month),
      amount: bucket.revenue,
      count: bucket.bookings,
    }));
}

/**
 * The self/agent reports return FULL booking DTOs for recentBookings;
 * RecentBookingsCard renders the reports' slimmer IBookingSummary shape.
 */
export function toBookingSummaries(bookings: IBooking[]): IBookingSummary[] {
  return bookings.map((booking) => ({
    id: booking.id,
    totalPrice: booking.totalPrice,
    bookingDate: new Date(booking.bookingDate),
    status: booking.status,
    tour: booking.tour ? { id: booking.tour.id, name: booking.tour.name } : null,
    customer: booking.customer,
  }));
}

export function paymentsTrendPoints(
  monthlyBreakdown: IPaymentsSummaryResponse["data"]["monthlyBreakdown"],
): TrendPoint[] {
  return [...monthlyBreakdown]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((bucket) => ({
      period: monthLabel(bucket.month),
      amount: bucket.revenue,
      count: bucket.count,
    }));
}
