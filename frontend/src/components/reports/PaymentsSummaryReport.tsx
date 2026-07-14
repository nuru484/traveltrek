// src/components/reports/PaymentsSummaryReport.tsx
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
import { RefreshCw, CreditCard, DollarSign, AlertCircle } from "lucide-react";
import { useGetPaymentsSummaryQuery } from "@/redux/reportsApi";
import { IReportsQueryParams, IPaymentSummary } from "@/types/reports.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { format } from "date-fns";
import { Money } from "@/components/ui/Money";

interface PaymentsSummaryReportProps {
  params: IReportsQueryParams;
}

export const PaymentsSummaryReport: React.FC<PaymentsSummaryReportProps> = ({
  params,
}) => {
  const { data, error, isError, isLoading, refetch } =
    useGetPaymentsSummaryQuery(params);

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
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-48"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const {
    summary,
    statusBreakdown,
    methodBreakdown,
    monthlyBreakdown,
    recentPayments,
  } = data.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payments Summary</h2>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Payments
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalPayments}</div>
            <p className="text-xs text-muted-foreground">
              Payment transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Money amount={summary.totalRevenue} symbol={`${summary.currency} `} />
            </div>
            <p className="text-xs text-muted-foreground">Completed payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Money amount={summary.pendingAmount} symbol={`${summary.currency} `} />
            </div>
            <p className="text-xs text-muted-foreground">Awaiting completion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Money amount={summary.failedAmount} symbol={`${summary.currency} `} />
            </div>
            <p className="text-xs text-muted-foreground">Failed transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Status Distribution</CardTitle>
          <CardDescription>Payments by status with amounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(statusBreakdown).map(([status, data]) => (
              <div
                key={status}
                className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Badge
                    variant={
                      status === "COMPLETED"
                        ? "default"
                        : status === "PENDING"
                        ? "secondary"
                        : status === "FAILED"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {status}
                  </Badge>
                  <span className="font-medium">{data.count}</span>
                </div>
                <div className="min-w-0 text-right">
                  <p className="font-medium">
                    <Money amount={data.amount} symbol={`${summary.currency} `} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>Distribution by payment method</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(methodBreakdown).map(([method, data]) => (
              <div
                key={method}
                className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-medium">{method.replace("_", " ")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {data.count} transactions
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="font-medium">
                    <Money amount={data.amount} symbol={`${summary.currency} `} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {((data.amount / summary.totalRevenue) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      {monthlyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Trends</CardTitle>
            <CardDescription>Payment trends by month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyBreakdown.map((month) => (
                <div
                  key={month.month}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg"
                >
                  <div>
                    <h4 className="truncate font-medium">
                      {format(new Date(month.month + "-01"), "MMMM yyyy")}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {month.count} payments
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="font-medium">
                      <Money amount={month.revenue} symbol={`${summary.currency} `} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Payments */}
      {recentPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
            <CardDescription>Latest payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPayments.slice(0, 10).map((payment) => (
                <PaymentItem key={payment.id} payment={payment} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const PaymentItem: React.FC<{ payment: IPaymentSummary }> = ({ payment }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg">
      <div className="flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium">#{payment.id}</span>
          <Badge
            variant={
              payment.status === "COMPLETED"
                ? "default"
                : payment.status === "PENDING"
                ? "secondary"
                : payment.status === "FAILED"
                ? "destructive"
                : "outline"
            }
          >
            {payment.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{payment.user.name}</p>
        <p className="text-sm text-muted-foreground">
          {payment.paymentMethod.replace("_", " ")} •{" "}
          {payment.booking.tour?.name || "No tour"}
        </p>
      </div>
      <div className="min-w-0 text-right">
        <p className="font-medium">
          <Money amount={payment.amount} symbol={`${payment.currency} `} />
        </p>
        <p className="text-sm text-muted-foreground">
          {payment.paymentDate
            ? format(new Date(payment.paymentDate), "MMM dd, yyyy")
            : "Pending"}
        </p>
      </div>
    </div>
  );
};
