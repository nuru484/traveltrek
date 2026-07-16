// src/components/customers/CustomerStats.tsx
//
// Lifetime activity for a customer profile, from the GET /customers/:id
// stats block: a StatsCard row (money in pesewas through formatMoney) and a
// strip of insight tiles. Every derived figure is null-safe — a brand-new
// customer renders em dashes, not blanks.
"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ICustomerProfile } from "@/types/customer.types";
import { BookingStatus } from "@/types/booking.types";
import { formatMoney } from "@/utils/format-money";

const STATUS_ORDER: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** One labelled insight tile in the boarding-pass voice. */
function InsightTile({
  label,
  children,
  caption,
}: {
  label: string;
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-foreground/15 bg-muted/30 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 min-w-0 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
        {children}
      </div>
      {caption && (
        <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}

interface CustomerStatsProps {
  stats: ICustomerProfile["stats"];
}

export function CustomerStats({ stats }: CustomerStatsProps) {
  const statusChips = STATUS_ORDER.filter(
    (status) => (stats.bookingsByStatus[status] ?? 0) > 0
  ).map((status) => ({
    label: STATUS_LABEL[status],
    value: stats.bookingsByStatus[status] ?? 0,
    color: (status === "CANCELLED" ? "destructive" : "outline") as
      | "destructive"
      | "outline",
  }));

  const lastBooking = stats.lastBookingAt ? new Date(stats.lastBookingAt) : null;
  const lastBookingValid =
    lastBooking !== null && !Number.isNaN(lastBooking.getTime());

  return (
    <section aria-label="Customer activity" className="space-y-3">
      <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <StatsCard
          title="Total spent"
          code="SPT"
          value={formatMoney(stats.totalSpent)}
        />
        <StatsCard
          title="Bookings"
          code="BKG"
          value={stats.totalBookings}
          details={statusChips.length > 0 ? statusChips : undefined}
        />
        <StatsCard title="Upcoming trips" code="UPC" value={stats.upcomingTrips} />
        <StatsCard
          title="Avg booking value"
          code="AVG"
          value={
            stats.averageBookingValue === null
              ? "—"
              : formatMoney(stats.averageBookingValue)
          }
          subtitle={
            stats.averageBookingValue === null
              ? "No completed payments"
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 @2xl/main:grid-cols-3">
        <InsightTile
          label="Favorite destination"
          caption={
            stats.favoriteDestination ? "Booked most often" : "No trips yet"
          }
        >
          {stats.favoriteDestination ? (
            <Link
              href={`/dashboard/destinations/${stats.favoriteDestination.id}/detail`}
              className="group inline-flex max-w-full items-baseline gap-1 underline-offset-4 hover:underline"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {stats.favoriteDestination.name}
              </span>
              <ArrowUpRight
                className="h-3.5 w-3.5 flex-none translate-y-0.5 text-muted-foreground transition-colors group-hover:text-foreground"
                aria-hidden
              />
            </Link>
          ) : (
            <span aria-label="No favorite destination">—</span>
          )}
        </InsightTile>

        <InsightTile
          label="Last booking"
          caption={
            lastBookingValid
              ? lastBooking.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "No bookings yet"
          }
        >
          {lastBookingValid ? (
            <span title={lastBooking.toLocaleString()}>
              {formatDistanceToNow(lastBooking, { addSuffix: true })}
            </span>
          ) : (
            <span aria-label="No bookings yet">—</span>
          )}
        </InsightTile>

        <InsightTile
          label="Payments on record"
          caption={`${formatMoney(stats.totalSpent, { exact: true })} completed lifetime`}
        >
          {stats.totalPayments.toLocaleString()}
        </InsightTile>
      </div>
    </section>
  );
}

export default CustomerStats;
