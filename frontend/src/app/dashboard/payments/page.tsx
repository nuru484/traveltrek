// src/app/dashboard/payments/page.tsx
"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { PaymentsDataTable } from "@/components/payments/table/PaymentsDataTable";
import {
  useGetAllPaymentsQuery,
  useGetAllCustomerPaymentsQuery,
} from "@/redux/paymentApi";
import { IPaymentsQueryParams } from "@/types/payment.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { isStaff } from "@/utils/roles";

const PaymentsPage = () => {
  const searchParams = useSearchParams();
  const user = useSelector((state: RootState) => state.auth.user);
  const staff = isStaff(user);

  const urlCustomerId = Number(searchParams.get("customerId"));

  const [params, setParams] = React.useState<IPaymentsQueryParams>({
    page: 1,
    limit: 10,
  });

  // Admin query
  const {
    data: adminPaymentsData,
    error: adminError,
    isError: isAdminError,
    isLoading: isAdminLoading,
    refetch: adminRefetch,
  } = useGetAllPaymentsQuery(params, {
    // Staff (admin or agent) see the global list; the backend scopes rows.
    skip: !staff || !!urlCustomerId,
  });

  // User query
  const {
    data: userPaymentsData,
    error: userError,
    isError: isUserError,
    isLoading: isUserLoading,
    refetch: userRefetch,
  } = useGetAllCustomerPaymentsQuery(
    {
      customerId: urlCustomerId || user?.id || 0,
      params,
    },
    {
      // Used for an explicit ?customerId (staff drill-down) or for a
      // customer's own payments; staff without a target skip it.
      skip: urlCustomerId ? false : !user?.id || staff,
    }
  );

  // Decide which data to show
  let paymentsData, error, isError, isLoading, refetch;

  if (urlCustomerId) {
    paymentsData = userPaymentsData;
    error = userError;
    isError = isUserError;
    isLoading = isUserLoading;
    refetch = userRefetch;
  } else if (user && !staff) {
    paymentsData = userPaymentsData;
    error = userError;
    isError = isUserError;
    isLoading = isUserLoading;
    refetch = userRefetch;
  } else if (staff) {
    paymentsData = adminPaymentsData;
    error = adminError;
    isError = isAdminError;
    isLoading = isAdminLoading;
    refetch = adminRefetch;
  }

  // Memoize all callback functions
  const handlePageChange = React.useCallback((page: number) => {
    setParams((prev) => ({ ...prev, page }));
  }, []);

  const handlePageSizeChange = React.useCallback((pageSize: number) => {
    setParams((prev) => ({ ...prev, limit: pageSize, page: 1 }));
  }, []);

  const handleFiltersChange = React.useCallback(
    (filters: Partial<Omit<IPaymentsQueryParams, "page" | "limit">>) => {
      setParams((prev) => ({ ...prev, ...filters, page: 1 }));
    },
    []
  );

  const filters = React.useMemo(
    () => ({
      search: params.search,
      status: params.status,
      paymentMethod: params.paymentMethod,
      customerId: params.customerId,
      bookingId: params.bookingId,
    }),
    [
      params.search,
      params.status,
      params.paymentMethod,
      params.customerId,
      params.bookingId,
    ]
  );

  const errorMessage = extractApiErrorMessage(error).message;

  if (isError) {
    return <ErrorMessage error={errorMessage} onRetry={refetch} />;
  }

  const payments = paymentsData?.data || [];
  const meta = paymentsData?.meta;

  return (
    <div className="mx-auto w-full max-w-7xl py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            {urlCustomerId && staff
              ? `All Payments for Customer #${urlCustomerId}`
              : staff && !urlCustomerId
              ? "All Payments"
              : "My Payments"}
          </h1>
          <p className="text-muted-foreground">
            {urlCustomerId
              ? "Manage payments for the selected customer"
              : staff
              ? "Manage all customer payments"
              : "View and manage your payments"}
          </p>
        </div>
      </div>

      <PaymentsDataTable
        data={payments}
        loading={isLoading}
        totalCount={meta?.total || 0}
        page={meta?.page || 1}
        pageSize={meta?.limit || 10}
        filters={filters}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onFiltersChange={handleFiltersChange}
        onRefresh={refetch}
        showFilters={true}
        showActions={true}
        showPagination={true}
        showSelection={true}
        showUser={staff}
        showBooking={true}
      />
    </div>
  );
};

export default PaymentsPage;
