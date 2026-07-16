// src/components/customers/CustomerPayments.tsx
"use client";
import * as React from "react";
import { PaymentsDataTable } from "@/components/payments/table/PaymentsDataTable";
import { useGetCustomerPaymentHistoryQuery } from "@/redux/customerApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CustomerPaymentsProps {
  customerId: number;
}

/** Full paginated payment history (GET /customers/:id/payments). */
export function CustomerPayments({ customerId }: CustomerPaymentsProps) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const {
    data: paymentsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetCustomerPaymentHistoryQuery({
    customerId,
    params: { page, limit: pageSize },
  });

  const payments = paymentsData?.data || [];
  const totalCount = paymentsData?.meta.total || 0;

  if (isError && error) {
    const { message } = extractApiErrorMessage(error);
    return (
      <Card className="w-full gap-3 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:py-0">
        <CardHeader className="pb-2 max-sm:px-0">
          <CardTitle className="text-lg sm:text-xl">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 max-sm:px-0">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Payments</AlertTitle>
            <AlertDescription>
              {message || "Failed to load payments. Please try again."}
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full gap-3 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:py-0">
      <CardHeader className="pb-2 max-sm:px-0">
        <CardTitle className="text-lg sm:text-xl">Payment History</CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalCount > 0
            ? `${totalCount} payment${totalCount === 1 ? "" : "s"} on record`
            : "No payments on record"}
        </p>
      </CardHeader>

      <CardContent className="pt-0 max-sm:px-0">
        <PaymentsDataTable
          data={payments}
          loading={isLoading}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          filters={{}}
          onPageChange={setPage}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setPage(1);
          }}
          onFiltersChange={() => {}}
          onRefresh={refetch}
          showFilters={false}
          showActions={true}
          showPagination={true}
          showSelection={false}
          showUser={false}
          showBooking={true}
        />
      </CardContent>
    </Card>
  );
}
