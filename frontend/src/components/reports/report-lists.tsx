// src/components/reports/report-lists.tsx
//
// Presentational list cards shared by the report tabs and the dashboard:
// recent bookings, recent payments, and the ranked top-tours leaderboard.
"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/Money";
import {
  IBookingSummary,
  IPaymentSummary,
  ITourTopStats,
} from "@/types/reports.types";
import { CardEmpty, RankedBarList, label } from "./report-charts";

const bookingStatusVariant = (
  status: IBookingSummary["status"],
): "default" | "secondary" | "destructive" | "outline" =>
  status === "CONFIRMED"
    ? "default"
    : status === "PENDING"
      ? "secondary"
      : status === "CANCELLED"
        ? "destructive"
        : "outline";

const paymentStatusVariant = (
  status: IPaymentSummary["status"],
): "default" | "secondary" | "destructive" | "outline" =>
  status === "COMPLETED"
    ? "default"
    : status === "PENDING"
      ? "secondary"
      : status === "FAILED" || status === "REFUND_REQUESTED"
        ? "destructive"
        : "outline";

function ListCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // p-4 below sm: the rows inside carry their own border + padding, and the
    // two paddings stacked leave the content too little width on phones.
    <Card className="gap-0 p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </Card>
  );
}

export function RecentBookingsCard({
  bookings,
}: {
  bookings: IBookingSummary[];
}) {
  return (
    <ListCard
      title="Recent bookings"
      meta={
        bookings.length > 0 ? (
          <Link
            href="/dashboard/bookings"
            className="text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        ) : undefined
      }
    >
      {bookings.length === 0 ? (
        <CardEmpty title="No bookings in this period" />
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 sm:p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={`/dashboard/bookings/${booking.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    #{booking.id}
                  </Link>
                  <Badge variant={bookingStatusVariant(booking.status)}>
                    {label(booking.status)}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {booking.customer.name}
                  {booking.tour ? ` · ${booking.tour.name}` : ""}
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="text-sm font-medium">
                  <Money amount={booking.totalPrice} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(booking.bookingDate), "MMM dd, yyyy")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ListCard>
  );
}

export function RecentPaymentsCard({
  payments,
}: {
  payments: IPaymentSummary[];
}) {
  return (
    <ListCard
      title="Recent payments"
      meta={
        payments.length > 0 ? (
          <Link
            href="/dashboard/payments"
            className="text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        ) : undefined
      }
    >
      {payments.length === 0 ? (
        <CardEmpty title="No payments in this period" />
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 sm:p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={`/dashboard/payments/${payment.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    #{payment.id}
                  </Link>
                  <Badge variant={paymentStatusVariant(payment.status)}>
                    {label(payment.status)}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {payment.customer.name} · {label(payment.paymentMethod)}
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="text-sm font-medium">
                  <Money amount={payment.amount} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {payment.paymentDate
                    ? format(new Date(payment.paymentDate), "MMM dd, yyyy")
                    : "No date"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ListCard>
  );
}

/** The dms ranked-bar leaderboard applied to top tours. */
export function TopToursRankedCard({ topTours }: { topTours: ITourTopStats[] }) {
  return (
    <RankedBarList
      title="Top tours by bookings"
      meta={
        topTours.length > 0
          ? `${topTours.length} ranked tour${topTours.length === 1 ? "" : "s"}`
          : undefined
      }
      emptyTitle="No tours with bookings in this period"
      items={topTours.map((tourStats) => ({
        key: tourStats.tour.id,
        name: tourStats.tour.name,
        href: `/dashboard/tours/${tourStats.tour.id}/detail`,
        amount: tourStats.statistics.totalRevenue,
        caption: `${tourStats.statistics.totalBookings} booking${
          tourStats.statistics.totalBookings === 1 ? "" : "s"
        }`,
      }))}
    />
  );
}
