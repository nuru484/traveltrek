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
import { useGetDashboardOverviewQuery } from "@/redux/reportsApi";
import { IReportsQueryParams } from "@/types/reports.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
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
      {/* Key Metrics */}
      <div className="grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
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
              Avg:{" "}
              <Money
                amount={bookings.data.summary.averageBookingValue}
                symbol={`${payments.data.summary.currency} `}
              />
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
              <Money
                amount={payments.data.summary.pendingAmount}
                symbol={`${payments.data.summary.currency} `}
              />
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
              {tours.data.summary.totalRevenueAnalyzed > 0 && (
                <Money
                  amount={tours.data.summary.totalRevenueAnalyzed}
                  symbol={`${payments.data.summary.currency} `}
                />
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid gap-4 @2xl/main:grid-cols-2">
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
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {method.replace("_", " ")}
                    </span>
                    <div className="flex-none text-right">
                      <div className="font-medium">{data.count}</div>
                      <div className="text-xs text-muted-foreground">
                        <Money
                          amount={data.amount}
                          symbol={`${payments.data.summary.currency} `}
                        />
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
