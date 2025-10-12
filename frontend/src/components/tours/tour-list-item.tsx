// src/components/tours/tour-list-item.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { useDeleteTourMutation } from "@/redux/tourApi";
import { useGetAllUserBookingsQuery } from "@/redux/bookingApi";
import { ITour } from "@/types/tour.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Clock,
  DollarSign,
  CalendarDays,
  Bookmark,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { BookingButton } from "../bookings/BookingButton";
import toast from "react-hot-toast";
import { truncateText } from "@/utils/truncateText";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

interface ITourListItemProps {
  tour: ITour;
}

export function TourListItem({ tour }: ITourListItemProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN" || user?.role === "AGENT";
  const [deleteTour, { isLoading: isDeleting }] = useDeleteTourMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: bookingsData,
    error: bookingsError,
    isError: isBookingsError,
    isLoading: isLoadingBookings,
    isFetching: isFetchingBookings,
  } = useGetAllUserBookingsQuery(
    { userId: user.id, params: { page: 1, limit: 1000 } },
    {
      skip: !user,
      refetchOnMountOrArgChange: 30,
    }
  );

  useEffect(() => {
    if (isBookingsError) {
      const { message } = extractApiErrorMessage(bookingsError);
      console.error("Failed to fetch user bookings:", bookingsError);
      toast.error(message || "Failed to load booking information");
    }
  }, [bookingsError, isBookingsError]);

  const userBooking = bookingsData?.data.find(
    (booking) =>
      booking.tour?.id === tour.id &&
      booking.userId === parseInt(user?.id || "0")
  );

  const bookingStatus = userBooking?.status;
  const isTourBooked = !!userBooking;

  const isFullyBooked = tour.guestsBooked >= tour.maxGuests;
  const availableSpots = tour.maxGuests - tour.guestsBooked;

  const isBookingDataLoading = isLoadingBookings || isFetchingBookings;

  const handleView = () => {
    router.push(`/dashboard/tours/${tour.id}/detail`);
  };

  const handleEdit = () => {
    router.push(`/dashboard/tours/${tour.id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteTour(tour.id).unwrap();
      toast.success("Tour deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete tour:", error);
      toast.error(message || "Failed to delete tour");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "upcoming":
        return "default";
      case "active":
        return "secondary";
      case "completed":
        return "outline";
      default:
        return "default";
    }
  };

  const getBookingStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <AlertCircle className="mr-2 h-4 w-4" />;
      case "CONFIRMED":
        return <CheckCircle className="mr-2 h-4 w-4" />;
      case "CANCELLED":
        return <XCircle className="mr-2 h-4 w-4" />;
      case "COMPLETED":
        return <CheckCircle className="mr-2 h-4 w-4" />;
      default:
        return <Bookmark className="mr-2 h-4 w-4" />;
    }
  };

  const getBookingButtonText = () => {
    if (isBookingDataLoading) {
      return "Loading...";
    }

    if (!bookingStatus) return "Book Now";

    switch (bookingStatus) {
      case "PENDING":
        return "Booked";
      case "CONFIRMED":
        return "Confirmed";
      case "CANCELLED":
        return "Cancelled";
      case "COMPLETED":
        return "Completed";
      default:
        return "Booked";
    }
  };

  const getBookingButtonVariant = () => {
    if (isBookingDataLoading) return "secondary";
    if (!bookingStatus) return "default";

    switch (bookingStatus) {
      case "PENDING":
        return "secondary";
      case "CONFIRMED":
        return "default";
      case "CANCELLED":
        return "outline";
      case "COMPLETED":
        return "outline";
      default:
        return "secondary";
    }
  };

  const isBookingButtonDisabled = () => {
    return (
      isBookingDataLoading ||
      isFullyBooked ||
      bookingStatus === "CANCELLED" ||
      bookingStatus === "COMPLETED"
    );
  };

  // Format destination display
  const getDestinationDisplay = () => {
    if (!tour.destination) return "Unknown";
    const { name, city, country } = tour.destination;
    if (city) {
      return `${name}, ${city}, ${country}`;
    }
    return `${name}, ${country}`;
  };

  return (
    <>
      <Card className="w-full hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group border border-border/50 hover:border-border overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            {/* Title & Status */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-base sm:text-lg truncate">
                {tour.name}
              </h3>
              <div className="mt-1 flex gap-2 flex-wrap">
                <Badge
                  variant={getStatusColor(tour.status)}
                  className="text-xs font-medium"
                >
                  {tour.status}
                </Badge>
                {isFullyBooked && (
                  <Badge variant="destructive" className="text-xs font-medium">
                    Fully Booked
                  </Badge>
                )}
                {/* Show loading skeleton or actual booking status */}
                {isBookingDataLoading ? (
                  <div className="h-5 w-24 bg-gray-200 animate-pulse rounded-full"></div>
                ) : (
                  isTourBooked && (
                    <Badge
                      variant={
                        bookingStatus === "CONFIRMED"
                          ? "default"
                          : bookingStatus === "CANCELLED"
                          ? "destructive"
                          : bookingStatus === "COMPLETED"
                          ? "outline"
                          : "secondary"
                      }
                      className="text-xs font-medium"
                    >
                      {bookingStatus}
                    </Badge>
                  )
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2 sm:mt-1">
                {tour.description || "No description available"}
              </p>
            </div>

            {/* Price */}
            <div className="sm:ml-4 text-left sm:text-right flex-shrink-0">
              <div className="flex items-center gap-1 text-primary font-bold text-lg sm:text-xl">
                <DollarSign className="h-4 w-4" />
                <span>${tour.price.toLocaleString()}</span>
              </div>
              <Badge variant="secondary" className="text-xs mt-1">
                {tour.type}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <div className="flex items-center gap-2 p-2 sm:p-3 bg-muted/30 rounded-lg">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Destination</p>
                <p
                  className="font-medium text-sm capitalize truncate"
                  title={getDestinationDisplay()}
                >
                  {tour.destination?.name || "Unknown"} |{" "}
                  {tour.destination?.country || "Unknown"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 sm:p-3 bg-muted/30 rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium text-sm">{tour.duration} Days</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 sm:p-3 bg-muted/30 rounded-lg">
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Guests</p>
                <p className="font-medium text-sm">
                  {tour.guestsBooked}/{tour.maxGuests}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 sm:p-3 bg-muted/30 rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium text-sm">
                  {formatDate(tour.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/30 rounded-lg mb-4 gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Tour Dates</p>
                <p className="font-medium text-sm">
                  {formatDate(tour.startDate)} - {formatDate(tour.endDate)}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p className="font-medium text-sm">
                {formatDate(tour.updatedAt)}
              </p>
            </div>
          </div>

          {/* Availability Indicator */}
          <div className="mb-4">
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  availableSpots > 10
                    ? "bg-green-500 w-full"
                    : availableSpots > 5
                    ? "bg-yellow-500 w-3/4"
                    : availableSpots > 0
                    ? "bg-red-500 w-1/4"
                    : "bg-gray-500 w-0"
                }`}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              {availableSpots > 10
                ? "Great availability"
                : availableSpots > 5
                ? "Limited spots"
                : availableSpots > 0
                ? "Few spots left"
                : "Fully booked"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleView}
              className="flex-1 sm:flex-none sm:min-w-[100px] group-hover:border-primary/50 transition-colors cursor-pointer"
              disabled={isDeleting}
            >
              <Eye className="mr-2 h-4 w-4" />
              View
            </Button>

            {isAdmin ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="flex-1 sm:flex-none sm:min-w-[100px] cursor-pointer"
                  disabled={isDeleting}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex-1 sm:flex-none sm:min-w-[100px] text-destructive hover:text-destructive hover:border-destructive/50 cursor-pointer"
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <BookingButton
                  tourId={tour.id}
                  price={tour.price}
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none sm:min-w-[100px] cursor-pointer"
                  disabled={isDeleting || isFullyBooked}
                  label={isFullyBooked ? "Fully Booked" : undefined}
                />
              </>
            ) : (
              <>
                {/* Show loading state or booking button */}
                {isBookingDataLoading ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 sm:flex-none sm:min-w-[100px] cursor-pointer"
                    disabled
                  >
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </Button>
                ) : isTourBooked ? (
                  <Button
                    variant={getBookingButtonVariant()}
                    size="sm"
                    className="flex-1 sm:flex-none sm:min-w-[100px] cursor-pointer"
                    disabled={isBookingButtonDisabled()}
                    onClick={handleView}
                  >
                    {getBookingStatusIcon(bookingStatus || "")}
                    {getBookingButtonText()}
                  </Button>
                ) : (
                  <BookingButton
                    tourId={tour.id}
                    price={tour.price}
                    userId={parseInt(user?.id || "0")}
                    variant="default"
                    size="sm"
                    className="flex-1 sm:flex-none sm:min-w-[100px] cursor-pointer"
                    disabled={isFullyBooked}
                    label={isFullyBooked ? "Fully Booked" : undefined}
                  />
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Tour"
        description={`Are you sure you want to delete "${truncateText(
          tour.name
        )}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        isDestructive
      />
    </>
  );
}
