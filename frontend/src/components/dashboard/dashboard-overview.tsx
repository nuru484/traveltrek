// src/components/dashboard/dashboard-overview.tsx
"use client";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { useGetDashboardStatsQuery } from "@/redux/dashboardApi";
import { StatsCard } from "./stats-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ErrorMessage from "@/components/ui/ErrorMessage";
import EmptyState from "@/components/ui/EmptyState";
import Link from "next/link";

/** Mono section label with a trailing hairline, as on the landing page. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {children}
      </span>
      <div className="hidden h-px flex-1 bg-foreground/15 sm:block" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-4">
        <Skeleton className="h-3 w-44" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="gap-0 py-5">
              <CardContent className="space-y-3 px-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-3 w-52" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="gap-0 py-5">
              <CardContent className="space-y-3 px-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardOverview() {
  const user = useSelector((state: RootState) => state.auth.user);
  const {
    data: dashboardData,
    isLoading,
    isError,
    refetch,
  } = useGetDashboardStatsQuery();

  const isAdmin = user?.role === "ADMIN";
  const stats = dashboardData?.data;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <ErrorMessage
        error="We encountered an error while fetching your data."
        title="Failed to load dashboard data"
        onRetry={() => refetch()}
      />
    );
  }

  if (!stats) {
    return (
      <EmptyState
        eyebrow="No data"
        title="Nothing to report yet."
        description="Statistics will appear here once the platform has activity."
      />
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Main stats */}
      <div className="space-y-4">
        <SectionLabel>Platform overview</SectionLabel>
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
              {
                label: "Rooms",
                value: stats.hotels.availableRooms,
                color: "secondary",
              },
            ]}
          />
          <StatsCard
            title="Flights"
            code="FLT"
            value={stats.flights.total}
            subtitle="Flight options"
            details={[
              {
                label: "Seats",
                value: stats.flights.availableSeats,
                color: "secondary",
              },
            ]}
          />
          <StatsCard
            title="Destinations"
            code="DST"
            value={stats.destinations.total}
            subtitle="Places to explore"
          />
        </div>
      </div>

      {/* Admin-only stats */}
      {isAdmin && stats.bookings && stats.users && (
        <div className="space-y-4">
          <SectionLabel>Management overview</SectionLabel>
          <div className="grid gap-4 md:grid-cols-2">
            <StatsCard
              title="Bookings"
              code="BKG"
              value={stats.bookings.total}
              subtitle="Total bookings"
              details={[
                { label: "Pending", value: stats.bookings.pending, color: "outline" },
                {
                  label: "Confirmed",
                  value: stats.bookings.confirmed,
                  color: "secondary",
                },
                {
                  label: "Completed",
                  value: stats.bookings.completed,
                  color: "default",
                },
              ]}
            />
            <StatsCard
              title="Users"
              code="USR"
              value={stats.users.total}
              subtitle="Registered users"
              details={[
                {
                  label: "Customers",
                  value: stats.users.customers,
                  color: "secondary",
                },
                { label: "Agents", value: stats.users.agents, color: "outline" },
                {
                  label: "Admins",
                  value: stats.users.admins,
                  color: "destructive",
                },
              ]}
            />
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
      {!isAdmin && user && (
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
                <Link href={`/dashboard/bookings?userId=${user.id}`}>
                  View my bookings
                </Link>
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
