// src/app/dashboard/payments/page.tsx
"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { PaymentsDataTable } from "@/components/payments/table/payments-data-table";
import {
  useGetAllPaymentsQuery,
  useGetAllCustomerPaymentsQuery,
} from "@/redux/paymentApi";
import { IPaymentMethod, IPaymentStatus } from "@/types/payment.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { isStaff } from "@/utils/roles";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import type { TableFiltersSpec } from "@/hooks/table-query-state-logic";

const PAYMENT_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "REFUND_REQUESTED",
] as const;

const PAYMENT_METHODS = [
  "CREDIT_CARD",
  "DEBIT_CARD",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
] as const;

// A type alias (not interface) so it satisfies the hook's Record constraint.
type IPaymentsTableFilters = {
  search?: string;
  status?: IPaymentStatus;
  paymentMethod?: IPaymentMethod;
};

// URL params are the source of truth on load, so ?status= deep links (e.g.
// the dashboard's needs-attention tiles) land pre-filtered; garbage values
// are dropped by the enum spec.
const FILTERS_SPEC: TableFiltersSpec<IPaymentsTableFilters> = {
  search: { kind: "string" },
  status: { kind: "enum", values: PAYMENT_STATUSES },
  paymentMethod: { kind: "enum", values: PAYMENT_METHODS },
};

const PaymentsPage = () => {
  const searchParams = useSearchParams();
  const user = useSelector((state: RootState) => state.auth.user);
  const staff = isStaff(user);

  const urlCustomerId = Number(searchParams.get("customerId"));

  // URL + session table state: deep links win, and navigating to a detail
  // and back restores the page/filters last used.
  const {
    page,
    pageSize,
    filters,
    queryParams,
    handlePageChange,
    handlePageSizeChange,
    handleFiltersChange,
  } = useTableQueryState<IPaymentsTableFilters>({ spec: FILTERS_SPEC });

  // Admin query
  const {
    data: adminPaymentsData,
    error: adminError,
    isError: isAdminError,
    isLoading: isAdminLoading,
    refetch: adminRefetch,
  } = useGetAllPaymentsQuery(queryParams, {
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
      params: queryParams,
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
          <h1 className="text-2xl font-bold sm:text-3xl">
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
        page={page}
        pageSize={pageSize}
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
