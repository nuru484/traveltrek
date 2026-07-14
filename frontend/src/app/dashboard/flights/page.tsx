// src/app/dashboard/flights/page.tsx
"use client";
import { useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { FlightList } from "@/components/flights/flight-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useRouter } from "next/navigation";
import { useGetAllFlightsQuery } from "@/redux/flightApi";
import { useGetAllDestinationsQuery } from "@/redux/destinationApi";
import { IFlightsQueryParams } from "@/types/flight.types";

export default function FlightsPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState<
    Omit<IFlightsQueryParams, "page" | "limit">
  >({
    search: undefined,
    airline: undefined,
    flightClass: undefined,
    originId: undefined,
    destinationId: undefined,
  });

  // Build query parameters
  const queryParams: IFlightsQueryParams = {
    page,
    limit,
    ...Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined)
    ),
  };

  const {
    data: flightsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAllFlightsQuery(queryParams);

  const { data: destinationsData } = useGetAllDestinationsQuery({
    limit: 100,
  });

  const handlePageChange = (newPage: number) => setPage(newPage);

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleFiltersChange = useCallback(
    (newFilters: Partial<typeof filters>) => {
      setFilters((prev) => ({
        ...prev,
        ...newFilters,
      }));
      setPage(1);
    },
    []
  );

  const handleCreateFlight = () => {
    router.push("/dashboard/flights/create");
  };

  return (
    <div className="container mx-auto space-y-6">
      <PageHeader
        title="Flights"
        description="Search, schedule, and manage every flight."
      />

      <FlightList
        toolbarActions={
          isAdmin ? (
            <Button
              size="sm"
              onClick={handleCreateFlight}
              className="cursor-pointer whitespace-nowrap"
            >
              Create Flight
            </Button>
          ) : undefined
        }
        data={flightsData?.data || []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        meta={
          flightsData?.meta || {
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
          }
        }
        filters={filters}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        onFiltersChange={handleFiltersChange}
        onRefetch={refetch}
        destinations={destinationsData?.data || []}
      />
    </div>
  );
}
