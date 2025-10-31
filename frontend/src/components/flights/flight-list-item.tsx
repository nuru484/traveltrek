"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { RootState } from "@/redux/store";
import { useDeleteFlightMutation } from "@/redux/flightApi";
import {
  useGetAllUserBookingsQuery,
  useUpdateBookingMutation,
} from "@/redux/bookingApi";
import { IFlight } from "@/types/flight.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plane,
  Clock,
  Eye,
  Edit,
  Trash2,
  Users,
  ArrowRight,
  Route,
  Bookmark,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import toast from "react-hot-toast";
import { truncateText } from "@/utils/truncateText";
import Image from "next/image";
import { BookingButton } from "../bookings/BookingButton";

interface IFlightListItemProps {
  flight: IFlight;
}

export function FlightListItem({ flight }: IFlightListItemProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";
  const isAgent = user?.role === "AGENT";
  const [deleteFlight, { isLoading: isDeleting }] = useDeleteFlightMutation();
  const [updateBooking, { isLoading: isCancelling }] =
    useUpdateBookingMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const {
    data: bookingsData,
    isLoading: isLoadingBookings,
    isFetching: isFetchingBookings,
    isError: isBookingsError,
    error: BookingsError,
  } = useGetAllUserBookingsQuery(
    { userId: user?.id, params: { page: 1, limit: 1000 } },
    {
      skip: !user,
      refetchOnMountOrArgChange: 30,
    }
  );

  const userBooking = bookingsData?.data.find(
    (booking) =>
      booking.flight?.id === flight.id &&
      booking.userId === parseInt(user?.id || "0")
  );

  const bookingStatus = userBooking?.status;
  const isFlightBooked = !!userBooking;
  const isBookingActive =
    isFlightBooked &&
    bookingStatus !== "CANCELLED" &&
    bookingStatus !== "COMPLETED";

  const isBookingDataLoading = isLoadingBookings || isFetchingBookings;

  // Check if flight is bookable based on status
  const flightStatus = flight.status ?? "SCHEDULED";
  const isFlightBookable = flightStatus === "SCHEDULED";
  const shouldShowBookButton = isFlightBookable && !isFlightBooked;

  useEffect(() => {
    if (isBookingsError) {
      const { message } = extractApiErrorMessage(BookingsError);
      console.error("Failed to fetch Bookings:", BookingsError);
      toast.error(message || "Failed to load bookings");
    }
  }, [isBookingsError, BookingsError]);

  const handleView = () => {
    router.push(`/dashboard/flights/${flight.id}/detail`);
  };

  const handleEdit = () => {
    router.push(`/dashboard/flights/${flight.id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteFlight(flight.id).unwrap();
      toast.success("Flight deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete flight:", error);
      toast.error(message || "Failed to delete flight");
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

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, HH:mm");
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getDestinationCode = (name: string) => {
    const words = name.split(" ");
    if (words.length >= 2) {
      return words[0].substring(0, 3).toUpperCase();
    }
    return name.substring(0, 3).toUpperCase();
  };

  const getFlightStatusConfig = () => {
    const status = flight.status ?? "SCHEDULED";

    switch (status) {
      case "SCHEDULED":
        return {
          variant: "secondary" as const,
          icon: Clock,
          label: "Scheduled",
        };
      case "DEPARTED":
        return {
          variant: "default" as const,
          icon: Plane,
          label: "Departed",
        };
      case "LANDED":
        return {
          variant: "default" as const,
          icon: CheckCircle,
          label: "Landed",
        };
      case "CANCELLED":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          label: "Cancelled",
        };
      case "DELAYED":
        return {
          variant: "outline" as const,
          icon: AlertCircle,
          label: "Delayed",
        };
      default:
        return {
          variant: "secondary" as const,
          icon: Clock,
          label: "Scheduled",
        };
    }
  };

  const getBookingButtonText = () => {
    if (isBookingDataLoading) {
      return "Loading...";
    }

    if (!isFlightBooked) {
      return flight.seatsAvailable <= 0 ? "Fully Booked" : "Book";
    }

    switch (bookingStatus) {
      case "PENDING":
        return "Pending";
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

  const getBookingBadgeVariant = () => {
    switch (bookingStatus) {
      case "CONFIRMED":
        return "default";
      case "CANCELLED":
        return "destructive";
      case "COMPLETED":
        return "outline";
      case "PENDING":
      default:
        return "secondary";
    }
  };

  const flightStatusConfig = getFlightStatusConfig();
  const FlightStatusIcon = flightStatusConfig.icon;

  return (
    <>
      <Card className="w-full hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row h-full">
            {/* Flight Image */}
            <div className="relative w-full md:w-1/5 h-40 md:h-auto flex-shrink-0">
              {flight.photo ? (
                <Image
                  src={flight.photo}
                  alt={`${flight.airline} ${flight.flightNumber}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 20vw"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <Plane className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
            </div>

            {/* Flight Information */}
            <div className="flex-1 p-4 sm:p-6 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                      {flight.airline}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {flight.flightClass}
                    </Badge>
                    {/* Flight Status Badge */}
                    <Badge
                      variant={flightStatusConfig.variant}
                      className="text-xs flex items-center gap-1"
                    >
                      <FlightStatusIcon className="h-3 w-3" />
                      {flightStatusConfig.label}
                    </Badge>
                    {/* Show loading skeleton or actual booking status */}
                    {isBookingDataLoading ? (
                      <div className="h-5 w-20 bg-gray-200 animate-pulse rounded-full"></div>
                    ) : (
                      isFlightBooked && (
                        <Badge
                          variant={getBookingBadgeVariant()}
                          className="text-xs"
                        >
                          {bookingStatus}
                        </Badge>
                      )
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Flight {flight.flightNumber}
                  </p>
                </div>

                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-lg sm:text-xl font-bold text-primary">
                    ₵{flight.price.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">per person</p>
                </div>
              </div>

              {/* Route Information */}
              <div className="flex items-center justify-between mb-3 py-2 px-3 bg-muted/30 rounded-lg">
                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground">From</p>
                  <p className="font-semibold text-sm">
                    {getDestinationCode(flight.origin.name)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {flight.origin.city || flight.origin.name}
                  </p>
                </div>

                <div className="flex flex-col items-center mx-4">
                  <div className="flex items-center gap-1">
                    <Route className="h-3 w-3 text-muted-foreground" />
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {flight.stops === 0
                      ? "Direct"
                      : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
                  </p>
                </div>

                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground">To</p>
                  <p className="font-semibold text-sm">
                    {getDestinationCode(flight.destination.name)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {flight.destination.city || flight.destination.name}
                  </p>
                </div>
              </div>

              {/* Flight Details */}
              <div className="flex flex-wrap justify-between text-xs text-muted-foreground mb-4 gap-2">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="hidden sm:inline">Departure:</span>
                  <span className="font-medium">
                    {formatDate(flight.departure)}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(flight.duration)}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>
                    {flight.seatsAvailable}/{flight.capacity} seats
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-auto flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleView}
                  className="flex-1 sm:flex-none sm:min-w-[80px] group-hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <Eye className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">View</span>
                  <span className="sm:hidden">Details</span>
                </Button>

                {isAdmin ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                      disabled={isDeleting}
                    >
                      <Edit className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Edit</span>
                      <span className="sm:hidden">Edit</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive hover:text-destructive hover:border-destructive/50 flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Delete</span>
                      <span className="sm:hidden">Del</span>
                    </Button>
                    {/* Admins can book only scheduled flights */}
                    {isFlightBookable && (
                      <BookingButton
                        flightId={flight.id}
                        price={flight.price}
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                        disabled={isDeleting || flight.seatsAvailable <= 0}
                        label={
                          flight.seatsAvailable <= 0
                            ? "Fully Booked"
                            : undefined
                        }
                      />
                    )}
                  </>
                ) : isAgent ? (
                  <>
                    {/* Agents can only view and book scheduled flights */}
                    {isFlightBookable && (
                      <BookingButton
                        flightId={flight.id}
                        price={flight.price}
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                        disabled={isDeleting || flight.seatsAvailable <= 0}
                        label={
                          flight.seatsAvailable <= 0
                            ? "Fully Booked"
                            : undefined
                        }
                      />
                    )}
                  </>
                ) : (
                  <>
                    {/* Regular users */}
                    {isBookingDataLoading ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 sm:flex-none sm:min-w-[80px]"
                        disabled
                      >
                        <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        Loading...
                      </Button>
                    ) : isFlightBooked ? (
                      <>
                        {isBookingActive && isFlightBookable ? (
                          // Active booking on scheduled flight - show cancel button
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowCancelDialog(true)}
                            disabled={isCancelling}
                            className="flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                          >
                            <X className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            {isCancelling ? "Cancelling..." : "Cancel"}
                          </Button>
                        ) : (
                          // Cancelled, Completed booking, or flight not scheduled - show status only
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 sm:flex-none sm:min-w-[80px] cursor-not-allowed"
                            disabled
                          >
                            <Bookmark className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            {getBookingButtonText()}
                          </Button>
                        )}
                      </>
                    ) : shouldShowBookButton ? (
                      // Not booked and flight is scheduled - show book button
                      <BookingButton
                        flightId={flight.id}
                        price={flight.price}
                        userId={parseInt(user?.id || "0")}
                        variant="default"
                        size="sm"
                        className="flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                        disabled={flight.seatsAvailable <= 0}
                        label={
                          flight.seatsAvailable <= 0
                            ? "Fully Booked"
                            : undefined
                        }
                      />
                    ) : null}
                  </>
                )}
              </div>

              {/* Availability Indicator */}
              {flightStatus === "SCHEDULED" && (
                <div className="px-0 sm:px-2 pt-4">
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        flight.seatsAvailable > 50
                          ? "bg-green-500 w-full"
                          : flight.seatsAvailable > 20
                          ? "bg-yellow-500 w-3/4"
                          : flight.seatsAvailable > 0
                          ? "bg-red-500 w-1/4"
                          : "bg-gray-500 w-0"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    {flight.seatsAvailable > 50
                      ? "Great availability"
                      : flight.seatsAvailable > 20
                      ? "Limited seats"
                      : flight.seatsAvailable > 0
                      ? "Few seats left"
                      : "Fully booked"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog - Only for Admins */}
      {isAdmin && (
        <ConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Flight"
          description={`Are you sure you want to delete "${truncateText(
            flight.flightNumber
          )}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />
      )}

      {/* Cancel Booking Confirmation Dialog */}
      <ConfirmationDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Cancel Booking"
        description={`Are you sure you want to cancel your booking for flight "${flight.flightNumber}" (${flight.airline})? This will update your booking status to CANCELLED.`}
        onConfirm={handleCancelBooking}
        confirmText="Cancel Booking"
        isDestructive
      />
    </>
  );
}
