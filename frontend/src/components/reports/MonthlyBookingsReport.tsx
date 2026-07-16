// src/components/reports/MonthlyBookingsReport.tsx
"use client";
import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGetMonthlyBookingsSummaryQuery } from "@/redux/reportsApi";
import { IReportsQueryParams, IBookingSummary } from "@/types/reports.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { format } from "date-fns";
import { Money } from "@/components/ui/Money";

interface MonthlyBookingsReportProps {
  params: IReportsQueryParams;
}

export const MonthlyBookingsReport: React.FC<MonthlyBookingsReportProps> = ({
  params }) => {
  const { data, error, isError, isLoading, refetch } =
    useGetMonthlyBookingsSummaryQuery(params);

  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  if (isError) {
    const errorMessage = extractApiErrorMessage(error).message;
    return <ErrorMessage error={errorMessage} onRetry={handleRefresh} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-48"></div>
            <div className="h-4 bg-muted rounded w-32"></div>
          </CardHeader>
          <CardContent className="max-sm:px-3">
            <div className="grid gap-4 @2xl/main:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { summary, monthlyBreakdown, statusBreakdown, bookings } = data.data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 @2xl/main:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-sans font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
              Total Bookings
            </CardTitle>
          </CardHeader>
          <CardContent className="max-sm:px-3">
            <div className="font-display text-3xl font-semibold tracking-tight">{summary.totalBookings}</div>
            <p className="text-xs text-muted-foreground">Across all tours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-sans font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="max-sm:px-3">
            <div className="font-display text-3xl font-semibold tracking-tight">
              <Money amount={summary.totalRevenue} />
            </div>
            <p className="text-xs text-muted-foreground">Generated revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-sans font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
              Average Value
            </CardTitle>
          </CardHeader>
          <CardContent className="max-sm:px-3">
            <div className="font-display text-3xl font-semibold tracking-tight">
              <Money amount={summary.averageBookingValue} />
            </div>
            <p className="text-xs text-muted-foreground">Per booking</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      {monthlyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Breakdown</CardTitle>
            <CardDescription>Bookings and revenue by month</CardDescription>
          </CardHeader>
          <CardContent className="max-sm:px-3">
            <div className="space-y-4">
              {monthlyBreakdown.map((month) => (
                <div
                  key={month.month}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 sm:p-4"
                >
                  <div>
                    <h4 className="font-medium">
                      {format(new Date(month.month + "-01"), "MMMM yyyy")}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {month.bookingCount} bookings
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="font-medium">
                      <Money amount={month.revenue} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Avg: <Money amount={month.averageValue} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
          <CardDescription>Bookings by status</CardDescription>
        </CardHeader>
        <CardContent className="max-sm:px-3">
          <div className="grid gap-4 grid-cols-2 @3xl/main:grid-cols-4">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <div
                key={status}
                className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg"
              >
                <Badge
                  variant={
                    status === "CONFIRMED"
                      ? "default"
                      : status === "PENDING"
                      ? "secondary"
                      : status === "CANCELLED"
                      ? "destructive"
                      : "outline"
                  }
                >
                  {status}
                </Badge>
                <span className="font-bold text-lg">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      {bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
            <CardDescription>Latest booking activity</CardDescription>
          </CardHeader>
          <CardContent className="max-sm:px-3">
            <div className="space-y-4">
              {bookings.slice(0, 10).map((booking) => (
                <BookingItem key={booking.id} booking={booking} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const BookingItem: React.FC<{ booking: IBookingSummary }> = ({ booking }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 sm:p-4">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium">#{booking.id}</span>
          <Badge
            variant={
              booking.status === "CONFIRMED"
                ? "default"
                : booking.status === "PENDING"
                ? "secondary"
                : booking.status === "CANCELLED"
                ? "destructive"
                : "outline"
            }
          >
            {booking.status}
          </Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">{booking.customer.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {booking.tour?.name || "No tour"}
        </p>
      </div>
      <div className="min-w-0 text-right">
        <p className="font-medium"><Money amount={booking.totalPrice} /></p>
        <p className="text-sm text-muted-foreground">
          {format(new Date(booking.bookingDate), "MMM dd, yyyy")}
        </p>
      </div>
    </div>
  );
};
