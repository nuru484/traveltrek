// src/components/rooms/room-detail.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { useDeleteRoomMutation } from "@/redux/roomApi";
import {
  useGetAllUserBookingsQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation,
} from "@/redux/bookingApi";
import { IRoom } from "@/types/room.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dropdown-menu";
import {
  Bed,
  Users,
  DollarSign,
  Edit,
  Trash2,
  Calendar,
  MoreHorizontal,
  Building,
  CheckCircle,
  XCircle,
  Bookmark,
  Loader2,
} from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import toast from "react-hot-toast";
import Image from "next/image";
import { BookingButton } from "../bookings/BookingButton";

interface IRoomDetailProps {
  room: IRoom;
}

export function RoomDetail({ room }: IRoomDetailProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";

  const [deleteRoom, { isLoading: isDeleting }] = useDeleteRoomMutation();
  const [createBooking, { isLoading: isBooking }] = useCreateBookingMutation();
  const [updateBooking, { isLoading: isCancelling }] =
    useUpdateBookingMutation();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const isAvailable = room.roomsAvailable > 0;

  const {
    data: bookingsData,
    isLoading: isLoadingBookings,
    isFetching: isFetchingBookings,
  } = useGetAllUserBookingsQuery(
    { userId: user?.id, params: { page: 1, limit: 1000 } },
    {
      skip: !user,
      refetchOnMountOrArgChange: 30,
    }
  );

  const userBooking = bookingsData?.data.find(
    (booking) =>
      booking?.room?.id === room.id &&
      booking.userId === parseInt(user?.id || "0")
  );

  const bookingStatus = userBooking?.status;
  const isRoomBooked = !!userBooking;
  const isBookingActive =
    isRoomBooked &&
    bookingStatus !== "CANCELLED" &&
    bookingStatus !== "COMPLETED";

  const isBookingDataLoading = isLoadingBookings || isFetchingBookings;

  const handleEdit = () => {
    router.push(`/dashboard/rooms/${room.id}/edit`);
  };

  const handleBook = async () => {
    if (!user?.id) {
      toast.error("Please log in to book a room");
      return;
    }

    try {
      await createBooking({
        userId: parseInt(user.id),
        roomId: room.id,
        totalPrice: room.price,
      }).unwrap();
      toast.success("Room booked successfully");
      setShowBookDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to book room:", error);
      toast.error(message || "Failed to book room");
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

  const handleDelete = async () => {
    try {
      await deleteRoom(room.id).unwrap();
      toast.success("Room deleted successfully");
      setShowDeleteDialog(false);
      router.push("/dashboard/rooms");
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete room:", error);
      toast.error(message || "Failed to delete room");
    }
  };

  const handleHotelClick = () => {
    if (room.hotel) {
      router.push(`/dashboard/hotels/${room.hotel.id}/detail`);
    }
  };

  const getBookingButtonText = () => {
    if (isBookingDataLoading) {
      return "Loading...";
    }

    if (!isRoomBooked) {
      return !isAvailable ? "Fully Booked" : "Book Now";
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
      (!isAvailable && !isRoomBooked) ||
      bookingStatus === "CANCELLED" ||
      bookingStatus === "COMPLETED"
    );
  };

  const handleBookingButtonClick = () => {
    if (isBookingDataLoading) {
      return;
    }

    if (!isRoomBooked) {
      setShowBookDialog(true);
    } else if (isBookingActive) {
      setShowCancelDialog(true);
    }
  };

  const truncatedRoomType =
    room.roomType.length > 50
      ? `${room.roomType.slice(0, 47)}...`
      : room.roomType;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  // Calculate availability percentage
  const availabilityPercentage =
    room.totalRooms > 0 ? (room.roomsAvailable / room.totalRooms) * 100 : 0;

  const getAvailabilityStatus = () => {
    if (room.roomsAvailable === 0) return "Fully booked";
    if (availabilityPercentage > 50) return "Great availability";
    if (availabilityPercentage > 20) return "Limited rooms";
    return "Few rooms left";
  };

  const getAvailabilityColor = () => {
    if (room.roomsAvailable === 0) return "bg-gray-500 w-0";
    if (availabilityPercentage > 50) return "bg-green-500 w-full";
    if (availabilityPercentage > 20) return "bg-yellow-500 w-3/4";
    return "bg-red-500 w-1/4";
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card className="overflow-hidden shadow-sm">
          {room.photo && (
            <div className="relative w-full h-64 md:h-80 lg:h-96">
              <Image
                src={room.photo}
                alt={room.roomType}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

              {/* Action buttons - Admin and User */}
              <div className="absolute top-4 right-4 flex gap-2">
                {!isAdmin && (
                  <Button
                    variant={isBookingActive ? "secondary" : "default"}
                    size="sm"
                    onClick={handleBookingButtonClick}
                    disabled={isBookingButtonDisabled()}
                    className="shadow-sm cursor-pointer"
                  >
                    {isBookingDataLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Bookmark className="h-4 w-4 mr-2" />
                    )}
                    <span className="hidden sm:inline">
                      {getBookingButtonText()}
                    </span>
                    <span className="sm:hidden">{getBookingButtonText()}</span>
                  </Button>
                )}

                {/* Admin Actions */}
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-white/90 hover:bg-white text-black shadow-sm cursor-pointer"
                        disabled={isDeleting}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={handleEdit}
                        disabled={isDeleting}
                        className="cursor-pointer"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Room
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={isDeleting}
                        className="text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Room
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="absolute bottom-6 left-4 sm:left-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={isAvailable ? "default" : "destructive"}
                      className="bg-white/90 text-black"
                    >
                      {isAvailable ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {room.roomsAvailable} Available
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Fully Booked
                        </>
                      )}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-white/90 text-black"
                    >
                      <Users className="h-3 w-3 mr-1" />
                      {room.capacity} Guest{room.capacity > 1 ? "s" : ""}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-white/90 text-black"
                    >
                      <DollarSign className="h-3 w-3 mr-1" />
                      {formatPrice(room.price)}/night
                    </Badge>
                    {isBookingDataLoading ? (
                      <div className="h-5 w-32 bg-white/70 animate-pulse rounded-full"></div>
                    ) : (
                      isRoomBooked && (
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
                          className="bg-white/90 text-black"
                        >
                          Booking: {bookingStatus}
                        </Badge>
                      )
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                    {room.roomType}
                  </h1>
                  {room.hotel && (
                    <p className="text-sm sm:text-base text-white/90">
                      {room.hotel.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <CardContent className="space-y-6 sm:space-y-8">
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              {room.hotel && (
                <Card className="border-l-4 border-l-primary">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Building className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground mb-1">
                          Hotel
                        </p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleHotelClick}
                              className="text-sm text-muted-foreground hover:text-primary transition-colors text-left w-full hover:underline"
                            >
                              {room.hotel.name}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View Hotel Details</p>
                          </TooltipContent>
                        </Tooltip>
                        {room.hotel.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {room.hotel.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card
                className={`border-l-4 ${
                  isAvailable ? "border-l-green-500" : "border-l-destructive"
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    {isAvailable ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-foreground mb-1">
                        Availability
                      </p>
                      <p
                        className={`text-sm ${
                          isAvailable ? "text-green-600" : "text-destructive"
                        }`}
                      >
                        {isAvailable
                          ? `${room.roomsAvailable}/${room.totalRooms} rooms available`
                          : "Fully booked"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Room Details and Pricing */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Bed className="h-5 w-5" />
                  Room Details
                </h3>

                <div className="space-y-4 pl-7">
                  <div>
                    <p className="font-medium text-foreground">Room Type</p>
                    <p className="text-sm text-muted-foreground">
                      {room.roomType}
                    </p>
                  </div>

                  {room.description && (
                    <div>
                      <p className="font-medium text-foreground">Description</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {room.description}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="font-medium text-foreground">Capacity</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {room.capacity} guest{room.capacity > 1 ? "s" : ""}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-foreground">
                      Room Availability
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {room.roomsAvailable} of {room.totalRooms} rooms available
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-foreground">Amenities</p>
                    {room.amenities && room.amenities.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {room.amenities.map((amenity, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs"
                          >
                            {amenity}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No amenities listed
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Pricing & Booking
                </h3>

                <div className="space-y-4 pl-7">
                  <div>
                    <p className="font-medium text-foreground">
                      Price per Night
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(room.price)}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-foreground">Status</p>
                    {isBookingDataLoading ? (
                      <div className="h-5 w-40 bg-gray-200 animate-pulse rounded"></div>
                    ) : (
                      <p
                        className={`text-sm flex items-center gap-2 ${
                          isAvailable ? "text-green-600" : "text-destructive"
                        }`}
                      >
                        {isAvailable ? (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            {isRoomBooked && isBookingActive
                              ? `Booking ${bookingStatus}`
                              : "Ready to book"}
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            Fully booked
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Availability Indicator */}
                  <div className="pt-2">
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${getAvailabilityColor()}`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      {getAvailabilityStatus()}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3 pt-4">
                    {isAdmin ? (
                      <>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleEdit}
                            variant="outline"
                            className="flex-1"
                            disabled={isDeleting}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => setShowDeleteDialog(true)}
                            variant="destructive"
                            className="flex-1"
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                        <BookingButton
                          roomId={room.id}
                          price={room.price}
                          variant="default"
                          size="lg"
                          className="w-full cursor-pointer"
                          disabled={isDeleting || !isAvailable}
                          label={!isAvailable ? "Fully Booked" : undefined}
                        />
                      </>
                    ) : (
                      <>
                        {/* Show loading state while fetching booking data */}
                        {isBookingDataLoading ? (
                          <Button
                            variant="secondary"
                            className="w-full"
                            size="lg"
                            disabled
                          >
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading...
                          </Button>
                        ) : !isAvailable && !isRoomBooked ? (
                          <Button disabled className="w-full" size="lg">
                            <XCircle className="h-4 w-4 mr-2" />
                            Fully Booked
                          </Button>
                        ) : bookingStatus === "CANCELLED" ||
                          bookingStatus === "COMPLETED" ? (
                          <Button
                            variant="secondary"
                            className="w-full"
                            size="lg"
                            disabled
                          >
                            <Bookmark className="h-4 w-4 mr-2" />
                            {bookingStatus === "CANCELLED"
                              ? "Cancelled"
                              : "Completed"}
                          </Button>
                        ) : isBookingActive ? (
                          <Button
                            onClick={handleBookingButtonClick}
                            variant="secondary"
                            className="w-full"
                            size="lg"
                            disabled={isCancelling}
                          >
                            <Bookmark className="h-4 w-4 mr-2" />
                            {isCancelling
                              ? "Cancelling..."
                              : `Cancel Booking (${bookingStatus})`}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleBookingButtonClick}
                            className="w-full"
                            size="lg"
                            disabled={isBooking || !isAvailable}
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            {isBooking ? "Booking..." : "Book This Room"}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Room Confirmation Dialog */}
        <ConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Room"
          description={`Are you sure you want to delete room "${truncatedRoomType}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />

        {/* Book Room Confirmation Dialog */}
        <ConfirmationDialog
          open={showBookDialog}
          onOpenChange={setShowBookDialog}
          title="Confirm Room Booking"
          description={`Are you sure you want to book "${room.roomType}"${
            room.hotel ? ` at "${room.hotel.name}"` : ""
          } for ${formatPrice(room.price)} per night?`}
          onConfirm={handleBook}
          confirmText="Book Room"
        />

        {/* Cancel Booking Confirmation Dialog */}
        <ConfirmationDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          title="Cancel Booking"
          description={`Are you sure you want to cancel your booking for room "${truncatedRoomType}"? This will update your booking status to CANCELLED.`}
          onConfirm={handleCancelBooking}
          confirmText="Cancel Booking"
          isDestructive
        />
      </div>
    </TooltipProvider>
  );
}
