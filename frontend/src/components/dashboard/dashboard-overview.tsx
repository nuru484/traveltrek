// src/components/dashboard/dashboard-overview.tsx
"use client";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { useGetDashboardStatsQuery } from "@/redux/dashboardApi";
import { StatsCard } from "./stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Plane,
  Hotel,
  MapPin,
  Users,
  Calendar,
  CreditCard,
  RefreshCw,
  TrendingUp,
  Building,
  Map,
  Sparkles,
} from "lucide-react";

// Loading Skeleton Component
function DashboardSkeleton() {
  return (
    <div className="space-y-8 pb-8">
      {/* Header Skeleton */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3 flex-1">
            <Skeleton className="h-10 w-3/4 max-w-md" />
            <Skeleton className="h-5 w-2/3 max-w-sm" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Main Stats Grid Skeleton */}
      <div>
        <div className="mb-4 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="relative overflow-hidden border-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-12 rounded-xl" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-3 w-32" />
                  <div className="flex gap-2 pt-3 border-t">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Management Overview Skeleton (for admin view) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <Skeleton className="h-10 w-56 rounded-full" />
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="relative overflow-hidden border-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-12 rounded-xl" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-3 w-32" />
                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-22 rounded-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions Skeleton */}
      <Card className="border-2">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-6 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
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
    isFetching,
  } = useGetDashboardStatsQuery();

  const isAdmin = user?.role === "ADMIN";
  const stats = dashboardData?.data;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <RefreshCw className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="text-destructive font-medium mb-2">
              Failed to load dashboard data
            </p>
            <p className="text-sm text-muted-foreground">
              We encountered an error while fetching your data
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Building className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header with Gradient Background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight break-all">
                Welcome back, {user?.name}!
              </h1>
              <Sparkles className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <p className="text-muted-foreground text-base">
              Here&apos;s what&apos;s happening with your travel platform today.
            </p>
          </div>
          <Button
            variant="outline"
            size="default"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 hover:text-foreground hover:cursor-pointer shadow-sm hover:shadow-md transition-all"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">
            Platform Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time statistics across all services
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Tours Available"
            value={stats.tours.total}
            subtitle="Total tour packages"
            icon={TrendingUp}
            color="blue"
            details={[
              {
                label: "Upcoming",
                value: stats.tours.upcoming,
                color: "secondary",
              },
              {
                label: "Ongoing",
                value: stats.tours.ongoing,
                color: "default",
              },
            ]}
          />

          <StatsCard
            title="Hotels & Rooms"
            value={stats.hotels.total}
            subtitle="Hotels available"
            icon={Hotel}
            color="green"
            details={[
              {
                label: "Available Rooms",
                value: stats.hotels.availableRooms,
                color: "secondary",
              },
            ]}
          />

          <StatsCard
            title="Flights Available"
            value={stats.flights.total}
            subtitle="Flight options"
            icon={Plane}
            color="purple"
            details={[
              {
                label: "Available Seats",
                value: stats.flights.availableSeats,
                color: "secondary",
              },
            ]}
          />

          <StatsCard
            title="Destinations"
            value={stats.destinations.total}
            subtitle="Places to explore"
            icon={Map}
            color="orange"
          />
        </div>
      </div>

      {/* Admin/Agent Only Stats */}
      {isAdmin && stats.bookings && stats.users && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50">
              <Building className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                Management Overview
              </h2>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <StatsCard
              title="Bookings"
              value={stats.bookings.total}
              subtitle="Total bookings"
              icon={Calendar}
              color="yellow"
              details={[
                {
                  label: "Pending",
                  value: stats.bookings.pending,
                  color: "outline",
                },
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
              value={stats.users.total}
              subtitle="Registered users"
              icon={Users}
              color="red"
              details={[
                {
                  label: "Customers",
                  value: stats.users.customers,
                  color: "secondary",
                },
                {
                  label: "Agents",
                  value: stats.users.agents,
                  color: "outline",
                },
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

      {/* Quick Actions */}
      <Card className="border-2 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building className="h-5 w-5 text-primary" />
            </div>
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/dashboard/tours" className="group">
              <Button
                variant="outline"
                className="justify-start hover:text-accent cursor-pointer w-full h-auto py-4 gap-3 hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-950/20 transition-all"
              >
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-medium">Browse Tours</span>
              </Button>
            </Link>
            <Link href="/dashboard/hotels" className="group">
              <Button
                variant="outline"
                className="justify-start hover:text-accent cursor-pointer w-full h-auto py-4 gap-3 hover:bg-green-50 hover:border-green-200 dark:hover:bg-green-950/20 transition-all"
              >
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 group-hover:scale-110 transition-transform">
                  <Hotel className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="font-medium">Find Hotels</span>
              </Button>
            </Link>
            <Link href="/dashboard/flights" className="group">
              <Button
                variant="outline"
                className="justify-start hover:text-accent cursor-pointer w-full h-auto py-4 gap-3 hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-950/20 transition-all"
              >
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 group-hover:scale-110 transition-transform">
                  <Plane className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="font-medium">Book Flights</span>
              </Button>
            </Link>
            <Link href="/dashboard/destinations" className="group">
              <Button
                variant="outline"
                className="justify-start hover:text-accent cursor-pointer w-full h-auto py-4 gap-3 hover:bg-orange-50 hover:border-orange-200 dark:hover:bg-orange-950/20 transition-all"
              >
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 group-hover:scale-110 transition-transform">
                  <MapPin className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="font-medium">Explore Destinations</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Card for Non-Admins */}
      {!isAdmin && (
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              Your Travel Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 space-y-6">
              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">
                  Start planning your next adventure!
                </p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Discover amazing destinations, book hotels, and create
                  unforgettable memories
                </p>
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                <Link href={`/dashboard/bookings?userId=${user.id}`}>
                  <Button
                    size="default"
                    className="gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <Calendar className="h-4 w-4" />
                    View My Bookings
                  </Button>
                </Link>

                <Link href="/dashboard/tours">
                  <Button
                    variant="outline"
                    size="default"
                    className="gap-2 hover:text-foreground hover:bg-muted cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    Browse Tours
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
