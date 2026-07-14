// src/components/reports/DashboardOverview.tsx
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
import { RefreshCw } from "lucide-react";
import { useGetDashboardOverviewQuery } from "@/redux/reportsApi";
import { IReportsQueryParams } from "@/types/reports.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { formatCurrency } from "@/utils/formatCurrency";
import { Money } from "@/components/ui/Money";

interface DashboardOverviewProps {
  params: Omit<IReportsQueryParams, "limit" | "minBookings">;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  params,
}) => {
  const { data, error, isError, isLoading, refetch } =
    useGetDashboardOverviewQuery(params);

  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  if (isError) {
    const errorMessage = extractApiErrorMessage(error).message;
    return <ErrorMessage error={errorMessage} onRetry={handleRefresh} />;
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted rounded w-24"></div>
              <div className="h-4 w-4 bg-muted rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-20 mb-2"></div>
              <div className="h-3 bg-muted rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { bookings, payments, tours } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Overview</h2>
          <p className="text-muted-foreground">
            {bookings.data.summary.period.month
              ? `${bookings.data.summary.period.month}/${bookings.data.summary.period.year}`
              : bookings.data.summary.period.year || "All Time"}
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-sans font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
              Total Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-3xl font-semibold tracking-tight">
              {bookings.data.summary.totalBookings}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(bookings.data.summary.averageBookingValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-sans font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-3xl font-semibold tracking-tight">
              <Money
                amount={payments.data.summary.totalRevenue}
                symbol={`${payments.data.summary.currency} `}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {payments.data.summary.totalPayments} payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-sans font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
              Pending Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-3xl font-semibold tracking-tight">
              {formatCurrency(
                payments.data.summary.pendingAmount,
                payments.data.summary.currency
              )}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-sans font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
              Top Tours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-3xl font-semibold tracking-tight">
              {tours.data.topTours.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {tours.data.summary.totalRevenueAnalyzed > 0 &&
                formatCurrency(tours.data.summary.totalRevenueAnalyzed)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Booking Status</CardTitle>
            <CardDescription>Distribution of booking statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(bookings.data.statusBreakdown).map(
                ([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
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
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Payment method distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(payments.data.methodBreakdown).map(
                ([method, data]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{method.replace("_", " ")}</span>
                    <div className="text-right">
                      <div className="font-medium">{data.count}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(
                          data.amount,
                          payments.data.summary.currency
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
