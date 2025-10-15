// src/app/dashboard/destinations/page.tsx
"use client";
import { useState, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import DestinationList from "@/components/destinations/DestinationList";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useDeleteAllDestinationsMutation,
  useGetAllDestinationsQuery,
} from "@/redux/destinationApi";
import toast from "react-hot-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { IDestinationQueryParams } from "@/types/destination.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

export default function DestinationsPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isAdmin = user?.role === "ADMIN" || user?.role === "AGENT";

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState<
    Omit<IDestinationQueryParams, "page" | "limit">
  >({
    search: undefined,
    country: undefined,
    city: undefined,
  });

  const [deleteAllDestinations, { isLoading: isDeletingAll }] =
    useDeleteAllDestinationsMutation();

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

  const handleDeleteAllDestinations = async () => {
    try {
      await deleteAllDestinations().unwrap();
      toast.success("All destinations deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete all destinations:", error);
      toast.error(message || "Failed to delete all destinations");
    }
  };

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Destinations</CardTitle>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateDestination}
              className="flex-1 sm:flex-none hover:text-foreground cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4 hidden sm:inline-block" />
              <span className="text-xs sm:text-sm">Create Destination</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeletingAll}
              className="flex-1 sm:flex-none text-destructive hover:text-destructive cursor-pointer"
            >
              <span className="text-xs sm:text-sm">Delete All</span>
            </Button>
          </div>
        )}
      </div>

      <DestinationList
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

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete All Destinations"
        description="Are you sure you want to delete all destinations? This will delete all hotels and flights to these destinations and cannot be undone."
        onConfirm={handleDeleteAllDestinations}
        confirmText="Delete"
        requireExactMatch="Delete All Destinations"
        isDestructive
      />
    </div>
  );
}
