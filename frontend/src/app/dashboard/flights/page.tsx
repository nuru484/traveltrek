// src/app/dashboard/flights/page.tsx
"use client";
import { useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { FlightList } from "@/components/flights/flight-list";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useDeleteAllFlightsMutation,
  useGetAllFlightsQuery,
} from "@/redux/flightApi";
import { useGetAllDestinationsQuery } from "@/redux/destinationApi";
import toast from "react-hot-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { IFlightsQueryParams } from "@/types/flight.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

export default function FlightsPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isAdmin = user?.role === "ADMIN" || user?.role === "AGENT";

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

  const [deleteAllFlights, { isLoading: isDeletingAll }] =
    useDeleteAllFlightsMutation();

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

  const handleDeleteAllFlights = async () => {
    const toastId = toast.loading("Deleting Flights...");

    try {
      await deleteAllFlights().unwrap();
      toast.dismiss(toastId);
      toast.success("All flights deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete all flights:", error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to delete all flights");
    }
  };

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Flights</CardTitle>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateFlight}
              className="flex-1 sm:flex-none hover:text-foreground cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4 hidden sm:inline-block" />
              <span className="text-xs sm:text-sm">Create Flight</span>
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

      <FlightList
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

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete All Flights"
        description="Are you sure you want to delete all flights? This action cannot be undone."
        onConfirm={handleDeleteAllFlights}
        confirmText="Delete"
        requireExactMatch="Delete All Flights"
        isDestructive
      />
    </div>
  );
}
