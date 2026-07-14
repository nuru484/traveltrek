// src/app/dashboard/destinations/page.tsx
"use client";
import { useState, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import DestinationList from "@/components/destinations/DestinationList";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useRouter } from "next/navigation";
import { useGetAllDestinationsQuery } from "@/redux/destinationApi";
import { IDestinationQueryParams } from "@/types/destination.types";

export default function DestinationsPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState<
    Omit<IDestinationQueryParams, "page" | "limit">
  >({
    search: undefined,
    country: undefined,
    city: undefined,
  });

  // Build query parameters
  const queryParams: IDestinationQueryParams = {
    page,
    limit,
    ...Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined)
    ),
  };

  const {
    data: destinationsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAllDestinationsQuery(queryParams);

  const { countries, cities } = useMemo(() => {
    if (!destinationsData?.data) return { countries: [], cities: [] };

    const countrySet = new Set<string>();
    const citySet = new Set<string>();

    destinationsData.data.forEach((dest) => {
      if (dest.country) countrySet.add(dest.country);
      if (dest.city) citySet.add(dest.city);
    });

    return {
      countries: Array.from(countrySet).sort(),
      cities: Array.from(citySet).sort(),
    };
  }, [destinationsData?.data]);

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

  const handleCreateDestination = () => {
    router.push("/dashboard/destinations/create");
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="Destinations"
        description="The places flights, hotels, and tours hang off."
      />

      <DestinationList
        toolbarActions={
          isAdmin ? (
            <Button
              size="sm"
              onClick={handleCreateDestination}
              className="cursor-pointer whitespace-nowrap"
            >
              Create Destination
            </Button>
          ) : undefined
        }
        data={destinationsData?.data || []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        meta={
          destinationsData?.meta || {
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
        countries={countries}
        cities={cities}
      />
    </div>
  );
}
