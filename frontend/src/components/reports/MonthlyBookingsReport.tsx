// src/components/reports/MonthlyBookingsReport.tsx
"use client";
import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Calendar, TrendingUp, Users } from "lucide-react";
import { useGetMonthlyBookingsSummaryQuery } from "@/redux/reportsApi";
import { IReportsQueryParams, IBookingSummary } from "@/types/reports.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { formatCurrency } from "@/utils/formatCurrency";
import { format } from "date-fns";

interface MonthlyBookingsReportProps {
  params: IReportsQueryParams;
}

export const MonthlyBookingsReport: React.FC<MonthlyBookingsReportProps> = ({
  params,
}) => {
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
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Monthly Bookings Report</h2>
          <p className="text-muted-foreground">
            {summary.period.month
              ? `${summary.period.month}/${summary.period.year}`
              : summary.period.year || "All Time"}
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Bookings
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalBookings}</div>
            <p className="text-xs text-muted-foreground">Across all tours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">Generated revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Value</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.averageBookingValue)}
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
          <CardContent>
            <div className="space-y-4">
              {monthlyBreakdown.map((month) => (
                <div
                  key={month.month}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h4 className="font-medium">
                      {format(new Date(month.month + "-01"), "MMMM yyyy")}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {month.bookingCount} bookings
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(month.revenue)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Avg: {formatCurrency(month.averageValue)}
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
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center justify-between p-3 border rounded-lg"
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
          <CardContent>
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
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center space-x-2">
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
        <p className="text-sm text-muted-foreground">{booking.user.name}</p>
        <p className="text-sm text-muted-foreground">
          {booking.tour?.name || "No tour"}
        </p>
      </div>
      <div className="text-right">
        <p className="font-medium">{formatCurrency(booking.totalPrice)}</p>
        <p className="text-sm text-muted-foreground">
          {format(new Date(booking.bookingDate), "MMM dd, yyyy")}
        </p>
      </div>
    </div>
  );
};
