// src/components/tours/tour-detail.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import Link from "next/link";
import { RootState } from "@/redux/store";
import { useDeleteTourMutation } from "@/redux/tourApi";
import {
  useGetAllUserBookingsQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation,
} from "@/redux/bookingApi";
import { ITour } from "@/types/tour.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Clock,
  MapPin,
  Edit,
  Trash2,
  Users,
  Bookmark,
  MoreHorizontal,
  Loader2,
  ExternalLink,
  ImageOff,
  FileText,
  DollarSign,
  Tag,
} from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import toast from "react-hot-toast";

interface ITourDetailProps {
  tour: ITour;
}

export function TourDetail({ tour }: ITourDetailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";

  const [deleteTour, { isLoading: isDeleting }] = useDeleteTourMutation();
  const [createBooking, { isLoading: isBooking }] = useCreateBookingMutation();
  const [updateBooking, { isLoading: isCancelling }] =
    useUpdateBookingMutation();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const {
    data: bookingsData,
    isLoading: isLoadingBookings,
    isFetching: isFetchingBookings,
    isError: isBookingsError,
    error: bookingsError,
  } = useGetAllUserBookingsQuery(
    { userId: user?.id, params: { page: 1, limit: 1000 } },
    {
      skip: !user,
      refetchOnMountOrArgChange: 30,
    }
  );

  useEffect(() => {
    if (isBookingsError) {
      const { message } = extractApiErrorMessage(bookingsError);
      console.error("Failed to fetch Bookings:", bookingsError);
      toast.error(message || "Failed to load bookings");
    }
  }, [isBookingsError, bookingsError]);

  const userBooking = bookingsData?.data.find(
    (booking) =>
      booking.tour?.id === tour.id &&
      booking.userId === parseInt(user?.id || "0")
  );

  const bookingStatus = userBooking?.status;
  const isTourBooked = !!userBooking;
  const isBookingActive =
    isTourBooked &&
    bookingStatus !== "CANCELLED" &&
    bookingStatus !== "COMPLETED";
  const isFullyBooked = tour.guestsBooked >= tour.maxGuests;

  const formatDate = (date: string | Date) => {
    return format(new Date(date), "MMM dd, yyyy");
  };

  const formatDateLong = (date: string | Date) => {
    return format(new Date(date), "EEEE, MMMM dd, yyyy 'at' h:mm a");
  };

  const formatDuration = (days: number) => `${days} day${days > 1 ? "s" : ""}`;

  const getDestinationDisplay = () => {
    if (!tour.destination) return "Unknown Destination";
    const { name, city, country } = tour.destination;
    if (city) {
      return `${name}, ${city}, ${country}`;
    }
    return `${name}, ${country}`;
  };

  const handleEdit = () => {
    router.push(`/admin-dashboard/tours/${tour.id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteTour(tour.id).unwrap();
      toast.success("Tour deleted successfully");
      setShowDeleteDialog(false);
      router.push(
        pathname.startsWith("/admin-dashboard")
          ? "/admin-dashboard/tours"
          : "/dashboard/tours"
      );
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete tour:", error);
      toast.error(message || "Failed to delete tour");
    }
  };

  const handleBook = async () => {
    try {
      await createBooking({
        userId: parseInt(user.id),
        tourId: tour.id,
        totalPrice: tour.price,
      }).unwrap();
      toast.success("Tour booked successfully");
      setShowBookDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to book tour:", error);
      toast.error(message || "Failed to book tour");
    }
  };

  const handleCancelBooking = async () => {
    if (!userBooking) return;

    const toastId = toast.loading("Cancelling booking...");

    try {
      await updateBooking({
        bookingId: userBooking.id,
        data: { status: "CANCELLED" },
      }).unwrap();

      toast.dismiss(toastId);
      toast.success("Booking cancelled successfully");
      setShowCancelDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to cancel booking");
      setShowCancelDialog(false);
    }
  };

  const getBookingButtonText = () => {
    if (isLoadingBookings || isFetchingBookings) {
      return "Loading...";
    }

    if (!isTourBooked) {
      return isFullyBooked ? "Fully Booked" : "Book Now";
    }

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

  const isBookingButtonDisabled = () => {
    return (
      isLoadingBookings ||
      isFetchingBookings ||
      isBooking ||
      isCancelling ||
      (isFullyBooked && !isTourBooked) ||
      bookingStatus === "CANCELLED" ||
      bookingStatus === "COMPLETED"
    );
  };

  const handleBookingButtonClick = () => {
    if (isLoadingBookings || isFetchingBookings) {
      return;
    }

    if (!isTourBooked) {
      setShowBookDialog(true);
    } else if (isBookingActive) {
      setShowCancelDialog(true);
    }
  };

  const truncatedTourName =
    tour.name.length > 50 ? `${tour.name.slice(0, 47)}...` : tour.name;

  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6">
        {/* Hero Section with Tour Image */}
        <Card className="overflow-hidden border-0 shadow-md">
          {
            <div className="relative w-full h-[200px] bg-gradient-to-br from-primary/10 via-primary/5 to-background">
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageOff className="h-16 w-16 text-muted-foreground/30" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-background/80 to-transparent">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="outline">
                        <Tag className="h-3 w-3 mr-1" />
                        {tour.type}
                      </Badge>
                      <Badge
                        variant={
                          tour.status === "UPCOMING"
                            ? "default"
                            : tour.status === "ONGOING"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {tour.status}
                      </Badge>
                      {isFullyBooked && (
                        <Badge variant="destructive">Fully Booked</Badge>
                      )}
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(tour.duration)}
                      </Badge>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                      {tour.name}
                    </h1>
                    {tour.destination && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="text-base md:text-lg">
                          {getDestinationDisplay()}
                        </span>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="cursor-pointer h-9 w-9"
                          disabled={isDeleting}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={handleEdit}
                          disabled={isDeleting}
                          className="cursor-pointer"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setShowDeleteDialog(true)}
                          disabled={isDeleting}
                          className="text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          }
        </Card>

        {/* Content Section */}
        <Card className="shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="space-y-6">
              {/* Description Section */}
              {tour.description && (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold text-foreground">
                        About This Tour
                      </h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {tour.description}
                    </p>
                  </div>

                  <Separator />
                </>
              )}

              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Destination */}
                {tour.destination && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Destination
                      </p>
                      <p className="text-base font-semibold text-foreground mb-2">
                        {getDestinationDisplay()}
                      </p>
                      <Link
                        href={`/dashboard/destinations/${tour.destination.id}/detail`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
                      >
                        View Details
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Price */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <DollarSign className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Price
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      ₵{tour.price.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      per person
                    </p>
                  </div>
                </div>

                {/* Duration */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Duration
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {formatDuration(tour.duration)}
                    </p>
                  </div>
                </div>

                {/* Start Date */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Start Date
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {formatDate(tour.startDate)}
                    </p>
                  </div>
                </div>

                {/* End Date */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      End Date
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {formatDate(tour.endDate)}
                    </p>
                  </div>
                </div>

                {/* Availability */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Availability
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {tour.guestsBooked} / {tour.maxGuests} guests
                    </p>
                    {isFullyBooked && (
                      <p className="text-xs text-destructive mt-1 font-medium">
                        Fully Booked
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Booking Status Section for Users */}
              {!isAdmin && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Bookmark className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">
                          Booking Status
                        </h2>
                      </div>
                    </div>

                    {isLoadingBookings || isFetchingBookings ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : isTourBooked ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
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
                            className="text-sm"
                          >
                            {bookingStatus}
                          </Badge>
                        </div>
                        {isBookingActive && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBookingButtonClick}
                            disabled={isCancelling}
                            className="cursor-pointer"
                          >
                            {isCancelling ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Cancel Booking
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-muted-foreground">
                          You haven&apos;t booked this tour yet.
                        </p>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleBookingButtonClick}
                          disabled={isBookingButtonDisabled()}
                          className="cursor-pointer"
                        >
                          {isBooking ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Bookmark className="mr-2 h-4 w-4" />
                          )}
                          {getBookingButtonText()}
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Metadata Footer */}
              {tour.createdAt && (
                <div className="pt-4 border-t">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Created:</span>
                      <span>{formatDateLong(tour.createdAt)}</span>
                    </div>
                    {tour.updatedAt && tour.createdAt !== tour.updatedAt && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">Last updated:</span>
                          <span>{formatDateLong(tour.updatedAt)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialogs */}
        <ConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Tour"
          description={`Are you sure you want to delete "${truncatedTourName}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />

        <ConfirmationDialog
          open={showBookDialog}
          onOpenChange={setShowBookDialog}
          title="Confirm Booking"
          description={`Are you sure you want to book "${truncatedTourName}" to ${getDestinationDisplay()} for ₵${tour.price.toLocaleString()}?`}
          onConfirm={handleBook}
          confirmText="Book Now"
        />

        <ConfirmationDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          title="Cancel Booking"
          description={`Are you sure you want to cancel your booking for "${truncatedTourName}"? This will update your booking status to CANCELLED.`}
          onConfirm={handleCancelBooking}
          confirmText="Cancel Booking"
          isDestructive
        />
      </div>
    </TooltipProvider>
  );
}
