// src/components/tours/tour-detail.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import Link from "next/link";
import { RootState } from "@/redux/store";
import {
  useDeleteTourMutation,
  useUpdateTourStatusMutation,
} from "@/redux/tourApi";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  CheckCircle,
  XCircle,
  PlayCircle,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import toast from "react-hot-toast";

interface ITourDetailProps {
  tour: ITour;
}

const getAvailableStatusTransitions = (currentStatus: string) => {
  const transitions: Record<string, string[]> = {
    UPCOMING: ["ONGOING", "CANCELLED"],
    ONGOING: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: ["UPCOMING"],
  };

  return transitions[currentStatus] || [];
};

const getTourStatusConfig = (status: string) => {
  switch (status) {
    case "UPCOMING":
      return {
        variant: "default" as const,
        icon: Clock,
        label: "Upcoming",
      };
    case "ONGOING":
      return {
        variant: "secondary" as const,
        icon: PlayCircle,
        label: "Ongoing",
      };
    case "COMPLETED":
      return {
        variant: "outline" as const,
        icon: CheckCircle,
        label: "Completed",
      };
    case "CANCELLED":
      return {
        variant: "destructive" as const,
        icon: XCircle,
        label: "Cancelled",
      };
    default:
      return {
        variant: "secondary" as const,
        icon: AlertCircle,
        label: status,
      };
  }
};

export function TourDetail({ tour }: ITourDetailProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";
  const isAgent = user?.role === "AGENT";
  const canUpdateStatus = isAdmin;

  const [deleteTour, { isLoading: isDeleting }] = useDeleteTourMutation();
  const [updateTourStatus, { isLoading: isUpdatingStatus }] =
    useUpdateTourStatusMutation();
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
  const isBookingDataLoading = isLoadingBookings || isFetchingBookings;

  const tourStatusConfig = getTourStatusConfig(tour.status);
  const StatusIcon = tourStatusConfig.icon;
  const availableStatusTransitions = getAvailableStatusTransitions(tour.status);

  const isLoading = isDeleting || isBooking || isCancelling || isUpdatingStatus;

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

  const handleStatusChange = async (newStatus: string) => {
    const toastId = toast.loading(`Updating tour status to ${newStatus}...`);

    try {
      await updateTourStatus({
        id: tour.id,
        status: newStatus,
      }).unwrap();

      toast.dismiss(toastId);
      toast.success(`Tour status updated to ${newStatus} successfully`);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to update tour status");
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/tours/${tour.id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteTour(tour.id).unwrap();
      toast.success("Tour deleted successfully");
      setShowDeleteDialog(false);
      router.push("/dashboard/tours");
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete tour:", error);
      toast.error(message || "Failed to delete tour");
    }
  };

  const handleBook = async () => {
    if (!user) {
      toast.error("Please log in to book a tour");
      router.push("/login");
      return;
    }

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
    if (isBookingDataLoading) {
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
      isBookingDataLoading ||
      isBooking ||
      isCancelling ||
      (isFullyBooked && !isTourBooked) ||
      bookingStatus === "CANCELLED" ||
      bookingStatus === "COMPLETED" ||
      tour.status === "CANCELLED" ||
      tour.status === "COMPLETED"
    );
  };

  const handleBookingButtonClick = () => {
    if (isBookingDataLoading) {
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
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="relative w-full h-[200px] sm:h-[220px] md:h-[240px] bg-gradient-to-br from-primary/10 via-primary/5 to-background">
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageOff className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/30" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 md:p-6 lg:p-8 bg-gradient-to-t from-background/90 via-background/80 to-transparent">
              <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-4">
                <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0 overflow-hidden">
                  {/* Badges Container with Scroll on Small Screens */}
                  <div className="flex flex-wrap gap-1 sm:gap-1.5 md:gap-2 mb-1.5 sm:mb-2 max-w-full overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                    <Badge
                      variant="outline"
                      className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                    >
                      <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                      {tour.type}
                    </Badge>
                    <Badge
                      variant={tourStatusConfig.variant}
                      className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                    >
                      <StatusIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                      {tourStatusConfig.label}
                    </Badge>
                    {isFullyBooked && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                      >
                        Fully Booked
                      </Badge>
                    )}
                    {isBookingDataLoading ? (
                      <div className="h-4 sm:h-5 w-20 sm:w-24 md:w-32 bg-white/70 animate-pulse rounded-full flex-shrink-0"></div>
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
                          className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                        >
                          Booking: {bookingStatus}
                        </Badge>
                      )
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                    >
                      <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                      {formatDuration(tour.duration)}
                    </Badge>
                  </div>

                  {/* Tour Name - Multi-line with Proper Wrapping */}
                  <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-foreground leading-tight break-words line-clamp-2 sm:line-clamp-3 overflow-hidden">
                    {tour.name}
                  </h1>

                  {/* Destination with Proper Wrapping */}
                  {tour.destination && (
                    <div className="flex items-start gap-1.5 sm:gap-2 text-muted-foreground max-w-full">
                      <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5 sm:mt-1" />
                      <span className="text-xs sm:text-sm md:text-base break-words line-clamp-2 overflow-hidden leading-snug">
                        {getDestinationDisplay()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions Dropdown - Always Visible */}
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
                  {!isAdmin && !isAgent && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isBookingActive ? "secondary" : "default"}
                          size="sm"
                          onClick={handleBookingButtonClick}
                          disabled={isBookingButtonDisabled()}
                          className="cursor-pointer h-7 sm:h-8 md:h-9 px-2 sm:px-2.5 md:px-3 text-[10px] sm:text-xs md:text-sm whitespace-nowrap"
                        >
                          {isBookingDataLoading ? (
                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1.5 md:mr-2 animate-spin" />
                          ) : (
                            <Bookmark className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1.5 md:mr-2" />
                          )}
                          <span className="hidden sm:inline">
                            {getBookingButtonText()}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px]">
                        <p className="text-xs">
                          {isBookingDataLoading
                            ? "Loading booking status..."
                            : isBookingActive
                            ? "Cancel booking"
                            : isTourBooked
                            ? `Booking ${bookingStatus}`
                            : "Book this tour"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {canUpdateStatus && availableStatusTransitions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer h-7 sm:h-8 md:h-9 px-1.5 sm:px-2 md:px-3 text-[10px] sm:text-xs md:text-sm"
                          disabled={isLoading}
                        >
                          <Badge
                            variant={tourStatusConfig.variant}
                            className="mr-1 text-[10px] sm:text-xs"
                          >
                            <StatusIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 sm:mr-1" />
                            <span className="hidden md:inline">
                              {tourStatusConfig.label}
                            </span>
                          </Badge>
                          <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 sm:w-48">
                        <div className="px-2 py-1.5 text-xs sm:text-sm font-semibold">
                          Update Status
                        </div>
                        <DropdownMenuSeparator />
                        {availableStatusTransitions.map((status) => {
                          const statusConfig = getTourStatusConfig(status);
                          const StatusIcon = statusConfig.icon;
                          return (
                            <DropdownMenuItem
                              key={status}
                              onClick={() => handleStatusChange(status)}
                              disabled={isLoading}
                              className="cursor-pointer text-xs sm:text-sm"
                            >
                              <StatusIcon className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              {statusConfig.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="cursor-pointer h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
                          disabled={isLoading}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 sm:w-44">
                        <DropdownMenuItem
                          onClick={handleEdit}
                          disabled={isLoading}
                          className="cursor-pointer text-xs sm:text-sm"
                        >
                          <Edit className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setShowDeleteDialog(true)}
                          disabled={isLoading}
                          className="text-destructive focus:text-destructive cursor-pointer text-xs sm:text-sm"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          </div>
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

                {/* Tour Status */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <StatusIcon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Tour Status
                    </p>
                    {canUpdateStatus &&
                    availableStatusTransitions.length > 0 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer w-full justify-between"
                            disabled={isLoading}
                          >
                            <div className="flex items-center">
                              <StatusIcon className="h-4 w-4 mr-2" />
                              {tourStatusConfig.label}
                            </div>
                            <ChevronDown className="h-4 w-4 ml-2" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          <div className="px-2 py-1.5 text-sm font-semibold">
                            Update Status
                          </div>
                          <DropdownMenuSeparator />
                          {availableStatusTransitions.map((status) => {
                            const statusConfig = getTourStatusConfig(status);
                            const StatusIcon = statusConfig.icon;
                            return (
                              <DropdownMenuItem
                                key={status}
                                onClick={() => handleStatusChange(status)}
                                disabled={isLoading}
                                className="cursor-pointer"
                              >
                                <StatusIcon className="mr-2 h-4 w-4" />
                                {statusConfig.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge
                        variant={tourStatusConfig.variant}
                        className="text-sm"
                      >
                        <StatusIcon className="h-4 w-4 mr-2" />
                        {tourStatusConfig.label}
                      </Badge>
                    )}
                  </div>
                </div>

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
                    {isFullyBooked ? (
                      <p className="text-xs text-destructive mt-1 font-medium flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Fully Booked
                      </p>
                    ) : tour.status === "CANCELLED" ? (
                      <p className="text-xs text-destructive mt-1 font-medium flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Tour cancelled
                      </p>
                    ) : tour.status === "COMPLETED" ? (
                      <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Tour completed
                      </p>
                    ) : (
                      <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {tour.maxGuests - tour.guestsBooked} spots remaining
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Booking Status Section for Users */}
              {!isAdmin && !isAgent && (
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

                    {isBookingDataLoading ? (
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
                          {tour.status === "CANCELLED"
                            ? "This tour has been cancelled."
                            : tour.status === "COMPLETED"
                            ? "This tour has been completed."
                            : isFullyBooked
                            ? "This tour is fully booked."
                            : "You haven't booked this tour yet."}
                        </p>
                        {tour.status !== "CANCELLED" &&
                          tour.status !== "COMPLETED" && (
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
                          )}
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
          description={`Are you sure youwant to book "${truncatedTourName}" to ${getDestinationDisplay()} for ₵${tour.price.toLocaleString()}?`}
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
