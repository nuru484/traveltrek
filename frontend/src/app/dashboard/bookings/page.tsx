// src/app/dashboard/bookings/page.tsx
"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { BookingsDataTable } from "@/components/bookings/table/bookings-data-table";
import {
  useGetAllBookingsQuery,
  useGetAllCustomerBookingsQuery,
} from "@/redux/bookingApi";
import { BookingStatus } from "@/types/booking.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { isAdmin as isAdminUser, isAgent as isAgentUser } from "@/utils/roles";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import type { TableFiltersSpec } from "@/hooks/table-query-state-logic";

const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
] as const;

// A type alias (not interface) so it satisfies the hook's Record constraint.
type IBookingsTableFilters = {
  search?: string;
  status?: BookingStatus;
};

// URL params are the source of truth on load, so ?status= deep links (e.g.
// the dashboard's needs-attention tiles) land pre-filtered; garbage values
// are dropped by the enum spec.
const FILTERS_SPEC: TableFiltersSpec<IBookingsTableFilters> = {
  search: { kind: "string" },
  status: { kind: "enum", values: BOOKING_STATUSES },
};

const BookingsPage = () => {
  const searchParams = useSearchParams();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = isAdminUser(user);
  const isAgent = isAgentUser(user);
  const canViewAllBookings = isAdmin || isAgent;

  const urlCustomerId = Number(searchParams.get("customerId"));

  // URL + session table state: deep links win, and navigating to a detail
  // and back restores the page/filters you left.
  const {
    page,
    pageSize,
    filters,
    queryParams,
    handlePageChange,
    handlePageSizeChange,
    handleFiltersChange,
  } = useTableQueryState<IBookingsTableFilters>({ spec: FILTERS_SPEC });

  // Queries
  const {
    data: adminBookingsData,
    error: adminError,
    isError: isAdminError,
    isLoading: isAdminLoading,
    refetch: adminRefetch,
  } = useGetAllBookingsQuery(queryParams, {
    skip: !canViewAllBookings || !!urlCustomerId,
  });

  const {
    data: userBookingsData,
    error: userError,
    isError: isUserError,
    isLoading: isUserLoading,
    refetch: userRefetch,
  } = useGetAllCustomerBookingsQuery(
    {
      customerId: urlCustomerId || user?.id || 0,
      params: queryParams,
    },
    {
      // Used for an explicit ?customerId (staff drill-down) or for a
      // customer's own bookings; staff without a target skip it.
      skip: urlCustomerId ? false : !user?.id || canViewAllBookings,
    }
  );

  // Decide which data to show
  let bookingsData, error, isError, isLoading, refetch;

  if (urlCustomerId) {
    bookingsData = userBookingsData;
    error = userError;
    isError = isUserError;
    isLoading = isUserLoading;
    refetch = userRefetch;
  } else if (user && !canViewAllBookings) {
    bookingsData = userBookingsData;
    error = userError;
    isError = isUserError;
    isLoading = isUserLoading;
    refetch = userRefetch;
  } else if (canViewAllBookings) {
    bookingsData = adminBookingsData;
    error = adminError;
    isError = isAdminError;
    isLoading = isAdminLoading;
    refetch = adminRefetch;
  }

  const errorMessage = extractApiErrorMessage(error).message;

  if (isError) {
    return <ErrorMessage error={errorMessage} onRetry={refetch} />;
  }

  const bookings = bookingsData?.data || [];
  const meta = bookingsData?.meta;

  return (
    <div className="mx-auto w-full max-w-7xl py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            {urlCustomerId && canViewAllBookings
              ? `All Bookings for Customer #${urlCustomerId}`
              : canViewAllBookings && !urlCustomerId
              ? "All Bookings"
              : "My Bookings"}
          </h1>
          <p className="text-muted-foreground">
            {urlCustomerId
              ? "Manage bookings for the selected customer"
              : canViewAllBookings
              ? "Manage all customer bookings"
              : "View and manage your bookings"}
          </p>
        </div>
      </div>

      <BookingsDataTable
        data={bookings}
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
      />
    </div>
  );
};

export default BookingsPage;
