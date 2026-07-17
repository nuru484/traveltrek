// src/components/dashboard/dashboard-overview.tsx
//
// The dashboard, dms-architecture edition: header → platform stats (row A)
// → business stats with trends (row B, staff) → needs-attention strip →
// paired widget rows (trend chart | status donut, recent bookings | top
// tours). Every widget owns its own query and renders its own
// skeleton/error/retry — no page-level all-or-nothing. Customers keep the
// platform stats, quick actions and their travel-summary block.
//
// Role note: the revenue/avg-booking cards, charts and ranked lists read the
// ADMIN-only report endpoints, so they render (and query) for admins ONLY —
// an agent's dashboard never fires a request it is forbidden to make.
// Agents keep the staff blocks their role can read (bookings/customers
// stats, needs-attention) plus a pointer to their own activity report.
"use client";
import { useSelector } from "react-redux";
import Link from "next/link";
import { RootState } from "@/redux/store";
import { isAdmin, isStaff } from "@/utils/roles";
import {
  useGetDashboardStatsQuery,
  useGetNeedsAttentionQuery,
} from "@/redux/dashboardApi";
import {
  useGetMonthlyBookingsSummaryQuery,
  useGetPaymentsSummaryQuery,
  useGetTopToursByBookingsQuery,
} from "@/redux/reportsApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { formatMoney } from "@/utils/format-money";
import { Button } from "@/components/ui/button";
import { StatsCard } from "./stats-card";
import { NeedsAttention } from "./needs-attention";
import {
  BusinessStatsSkeleton,
  NeedsAttentionSkeleton,
  PlatformStatsSkeleton,
  StatsCardSkeleton,
} from "./skeletons";
import {
  BreakdownDonut,
  CardError,
  ChartCardSkeleton,
  ListCardSkeleton,
  TrendChart,
} from "@/components/reports/report-charts";
import {
  bookingStatusSegments,
  bookingsTrendPoints,
} from "@/components/reports/report-data";
import {
  RecentBookingsCard,
  TopToursRankedCard,
} from "@/components/reports/report-lists";

/** Mono section label with a trailing hairline, as on the landing page. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

export function DashboardOverview() {
  const user = useSelector((state: RootState) => state.auth.user);
  // Backend sends the bookings/users blocks to ADMIN and AGENT alike.
  const staff = isStaff(user);
  // The report summaries below are ADMIN-only endpoints — never fire them
  // for agents (they would just 403 into error cards).
  const admin = isAdmin(user);

  const statsQuery = useGetDashboardStatsQuery();
  const attentionQuery = useGetNeedsAttentionQuery(undefined, { skip: !staff });
  // Business widgets read the reports endpoints with their default window
  // (the current year), so trends compare against the previous year.
  const bookingsQuery = useGetMonthlyBookingsSummaryQuery({}, { skip: !admin });
  const paymentsQuery = useGetPaymentsSummaryQuery({}, { skip: !admin });
  const toursQuery = useGetTopToursByBookingsQuery({}, { skip: !admin });

  const stats = statsQuery.data?.data;
  const attention = attentionQuery.data?.data;
  const bookingsReport = bookingsQuery.data?.data;
  const paymentsReport = paymentsQuery.data?.data;
  const toursReport = toursQuery.data?.data;

  const statsError = extractApiErrorMessage(statsQuery.error).message;
  const attentionError = extractApiErrorMessage(attentionQuery.error).message;
  const bookingsError = extractApiErrorMessage(bookingsQuery.error).message;
  const paymentsError = extractApiErrorMessage(paymentsQuery.error).message;
  const toursError = extractApiErrorMessage(toursQuery.error).message;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-8">
      {/* Platform stats — row A */}
      <div className="space-y-4">
        <SectionLabel>Platform overview</SectionLabel>
        {statsQuery.isLoading ? (
          <PlatformStatsSkeleton />
        ) : statsQuery.isError || !stats ? (
          <CardError
            title="Platform overview"
            message={statsError || "Failed to load platform stats"}
            onRetry={statsQuery.refetch}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Tours"
              code="TRS"
              value={stats.tours.total}
              subtitle="Total tour packages"
              details={[
                { label: "Upcoming", value: stats.tours.upcoming, color: "secondary" },
                { label: "Ongoing", value: stats.tours.ongoing, color: "default" },
              ]}
            />
            <StatsCard
              title="Hotels"
              code="HTL"
              value={stats.hotels.total}
              subtitle="Hotels available"
              details={[
                { label: "Rooms", value: stats.hotels.availableRooms, color: "secondary" },
              ]}
            />
            <StatsCard
              title="Flights"
              code="FLT"
              value={stats.flights.total}
              subtitle="Flight options"
              details={[
                { label: "Seats", value: stats.flights.availableSeats, color: "secondary" },
              ]}
            />
            <StatsCard
              title="Destinations"
              code="DST"
              value={stats.destinations.total}
              subtitle="Places to explore"
            />
          </div>
        )}
      </div>

      {/* Business stats — row B (staff) */}
      {staff && (
        <div className="space-y-4">
          <SectionLabel>Business overview</SectionLabel>
          {statsQuery.isLoading &&
          bookingsQuery.isLoading &&
          paymentsQuery.isLoading ? (
            <BusinessStatsSkeleton />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Bookings + customers ← dashboard stats */}
              {statsQuery.isLoading ? (
                <>
                  <StatsCardSkeleton pills={3} />
                  <StatsCardSkeleton pills={1} />
                </>
              ) : statsQuery.isError || !stats?.bookings || !stats.users ? (
                <div className="sm:col-span-2">
                  <CardError
                    title="Bookings & customers"
                    message={statsError || "Failed to load booking stats"}
                    onRetry={statsQuery.refetch}
                  />
                </div>
              ) : (
                <>
                  <StatsCard
                    title="Bookings"
                    code="BKG"
                    value={stats.bookings.total}
                    subtitle="All time"
                    details={[
                      { label: "Pending", value: stats.bookings.pending, color: "outline" },
                      { label: "Confirmed", value: stats.bookings.confirmed, color: "secondary" },
                      { label: "Completed", value: stats.bookings.completed, color: "default" },
                    ]}
                  />
                  <StatsCard
                    title="Customers"
                    code="CST"
                    value={stats.users.customers}
                    subtitle="Registered"
                    details={[
                      { label: "Staff", value: stats.users.agents + stats.users.admins, color: "outline" },
                    ]}
                  />
                </>
              )}

              {/* Revenue ← payments summary (this year, ADMIN only) */}
              {!admin ? null : paymentsQuery.isLoading ? (
                <StatsCardSkeleton pills={2} />
              ) : paymentsQuery.isError || !paymentsReport ? (
                <CardError
                  title="Revenue"
                  message={paymentsError || "Failed to load revenue"}
                  onRetry={paymentsQuery.refetch}
                />
              ) : (
                <StatsCard
                  title="Revenue"
                  code="REV"
                  value={formatMoney(paymentsReport.summary.totalRevenue)}
                  subtitle="This year"
                  trend={paymentsReport.summary.trends.totalRevenue}
                  details={[
                    {
                      label: "Pending",
                      value: formatMoney(paymentsReport.summary.pendingAmount),
                      color: "outline",
                    },
                  ]}
                />
              )}

              {/* Avg booking value ← bookings summary (this year, ADMIN only) */}
              {!admin ? null : bookingsQuery.isLoading ? (
                <StatsCardSkeleton pills={1} />
              ) : bookingsQuery.isError || !bookingsReport ? (
                <CardError
                  title="Avg booking value"
                  message={bookingsError || "Failed to load booking value"}
                  onRetry={bookingsQuery.refetch}
                />
              ) : (
                <StatsCard
                  title="Avg booking"
                  code="AVG"
                  value={formatMoney(bookingsReport.summary.averageBookingValue)}
                  subtitle="This year"
                  trend={bookingsReport.summary.trends.averageBookingValue}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Needs attention (staff) */}
      {staff &&
        (attentionQuery.isLoading ? (
          <NeedsAttentionSkeleton />
        ) : attentionQuery.isError || !attention ? (
          <CardError
            title="Needs attention"
            message={attentionError || "Failed to load the attention summary"}
            onRetry={attentionQuery.refetch}
          />
        ) : (
          <NeedsAttention data={attention} />
        ))}

      {/* Bookings over time | status donut (ADMIN — reads admin-only reports) */}
      {admin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {bookingsQuery.isLoading ? (
            <ChartCardSkeleton title="Bookings over time" height={280} />
          ) : bookingsQuery.isError || !bookingsReport ? (
            <CardError
              title="Bookings over time"
              message={bookingsError || "Failed to load trend"}
              onRetry={bookingsQuery.refetch}
            />
          ) : (
            <TrendChart
              title="Bookings over time"
              data={bookingsTrendPoints(bookingsReport.monthlyBreakdown)}
            />
          )}

          {bookingsQuery.isLoading ? (
            <ChartCardSkeleton title="Bookings by status" height={280} />
          ) : bookingsQuery.isError || !bookingsReport ? (
            <CardError
              title="Bookings by status"
              message={bookingsError || "Failed to load breakdown"}
              onRetry={bookingsQuery.refetch}
            />
          ) : (
            <BreakdownDonut
              title="Bookings by status"
              segments={bookingStatusSegments(bookingsReport.statusBreakdown)}
              valueKind="count"
            />
          )}
        </div>
      )}

      {/* Recent bookings | top tours (ADMIN — reads admin-only reports) */}
      {admin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {bookingsQuery.isLoading ? (
            <ListCardSkeleton title="Recent bookings" />
          ) : bookingsQuery.isError || !bookingsReport ? (
            <CardError
              title="Recent bookings"
              message={bookingsError || "Failed to load bookings"}
              onRetry={bookingsQuery.refetch}
            />
          ) : (
            <RecentBookingsCard bookings={bookingsReport.bookings} />
          )}

          {toursQuery.isLoading ? (
            <ListCardSkeleton title="Top tours by bookings" rows={6} />
          ) : toursQuery.isError || !toursReport ? (
            <CardError
              title="Top tours by bookings"
              message={toursError || "Failed to load top tours"}
              onRetry={toursQuery.refetch}
            />
          ) : (
            <TopToursRankedCard topTours={toursReport.topTours} />
          )}
        </div>
      )}

      {/* Agents: the analytics above are admin-only; point at the report
          their role owns instead of rendering forbidden widgets. */}
      {staff && !admin && (
        <div className="space-y-4">
          <SectionLabel>My activity</SectionLabel>
          <div className="flex flex-col gap-4 rounded-xl border border-foreground/15 bg-card px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">Your bookings and payments, period by period</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The activity report covers everything you have processed —
                bookings handled, payments taken, and how this period compares.
              </p>
            </div>
            <Button asChild variant="outline" className="flex-none cursor-pointer">
              <Link href="/dashboard/reports">View my activity</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-4">
        <SectionLabel>Quick actions</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Browse tours", href: "/dashboard/tours" },
            { label: "Find hotels", href: "/dashboard/hotels" },
            { label: "Book flights", href: "/dashboard/flights" },
            { label: "Explore destinations", href: "/dashboard/destinations" },
          ].map((action) => (
            <Button
              key={action.href}
              variant="outline"
              asChild
              className="h-auto justify-between rounded-lg px-4 py-3.5"
            >
              <Link href={action.href}>
                <span className="font-medium">{action.label}</span>
                <span
                  aria-hidden
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  →
                </span>
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Customer summary */}
      {!staff && user && (
        <div className="overflow-hidden rounded-xl border border-foreground/15 bg-card">
          <div className="px-6 py-10 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Your travel summary
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Start planning your next adventure.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Discover destinations, book hotels and flights, and keep every
              trip in one place.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild className="cursor-pointer">
                <Link href="/dashboard/bookings">View my bookings</Link>
              </Button>
              <Button asChild variant="outline" className="cursor-pointer">
                <Link href="/dashboard/tours">Browse tours</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
