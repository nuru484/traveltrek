// src/components/rooms/room-detail.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { useDeleteRoomMutation } from "@/redux/roomApi";
import { useGetAllUserBookingsQuery } from "@/redux/bookingApi";
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
  MoreHorizontal,
  Building,
  CheckCircle,
  XCircle,
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
  const isAgent = user?.role === "AGENT";
  const canManageRooms = isAdmin || isAgent;

  console.log(room);

  const [deleteRoom, { isLoading: isDeleting }] = useDeleteRoomMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isAvailable = room.roomsAvailable > 0;

  const {
    data: bookingsData,
    isLoading: isLoadingBookings,
    isFetching: isFetchingBookings,
  } = useGetAllUserBookingsQuery(
    { userId: user?.id, params: { page: 1, limit: 1000 } },
    {
      skip: !user || canManageRooms,
      refetchOnMountOrArgChange: 30,
    }
  );

  // Find active booking for this room
  const userBooking = bookingsData?.data.find(
    (booking) =>
      booking?.room?.id === room.id &&
      booking.userId === parseInt(user?.id || "0") &&
      booking.status !== "CANCELLED" &&
      booking.status !== "COMPLETED"
  );

  const hasActiveBooking = !!userBooking;
  const isBookingDataLoading = isLoadingBookings || isFetchingBookings;

  const handleEdit = () => {
    router.push(`/dashboard/rooms/${room.id}/edit`);
  };

  const handleDelete = async () => {
    const toastId = toast.loading("Deleting room...");

    try {
      await deleteRoom(room.id).unwrap();
      toast.dismiss(toastId);
      toast.success("Room deleted successfully");
      setShowDeleteDialog(false);
      router.push("/dashboard/hotels");
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete room:", error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to delete room");
    }
  };

  const handleHotelClick = () => {
    if (room.hotel) {
      router.push(`/dashboard/hotels/${room.hotel.id}/detail`);
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
      minimumFractionDigits: 2,
    }).format(price);
  };

  const availabilityPercentage =
    room.totalRooms > 0 ? (room.roomsAvailable / room.totalRooms) * 100 : 0;

  const getAvailabilityStatus = () => {
    if (room.roomsAvailable === 0) return "Fully booked";
    if (availabilityPercentage > 50) return "Great availability";
    if (availabilityPercentage > 20) return "Limited rooms";
    return "Few rooms left";
  };

  const getAvailabilityColor = () => {
    if (room.roomsAvailable === 0) return "bg-gray-500";
    if (availabilityPercentage > 50) return "bg-green-500";
    if (availabilityPercentage > 20) return "bg-yellow-500";
    return "bg-red-500";
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

              {/* Action buttons - Admin/Agent only */}
              {canManageRooms && (
                <div className="absolute top-4 right-4">
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
                </div>
              )}

              {/* Room Header Info */}
              <div className="absolute bottom-6 left-4 sm:left-6 right-4">
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
                      {formatPrice(room.pricePerNight)}/night
                    </Badge>
                    {!canManageRooms && isBookingDataLoading && (
                      <div className="h-6 w-24 bg-white/70 animate-pulse rounded-full"></div>
                    )}
                    {!canManageRooms &&
                      hasActiveBooking &&
                      !isBookingDataLoading && (
                        <Badge
                          variant={
                            userBooking?.status === "CONFIRMED"
                              ? "default"
                              : "secondary"
                          }
                          className="bg-white/90 text-black"
                        >
                          Booked: {userBooking?.status}
                        </Badge>
                      )}
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                    {room.roomType}
                  </h1>
                  {room.hotel && (
                    <button
                      onClick={handleHotelClick}
                      className="text-sm sm:text-base hover:cursor-pointer text-white/90 hover:text-white hover:underline transition-colors flex items-center gap-1"
                    >
                      <Building className="h-4 w-4" />
                      {room.hotel.name}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <CardContent className="space-y-6 sm:space-y-8 p-4 sm:p-6">
            {/* Hotel and Availability Cards */}
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
                        className={`text-sm font-medium ${
                          isAvailable ? "text-green-600" : "text-destructive"
                        }`}
                      >
                        {isAvailable
                          ? `${room.roomsAvailable} of ${room.totalRooms} rooms available`
                          : "Fully booked"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getAvailabilityStatus()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Room Details and Booking Section */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Room Details */}
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
                      Up to {room.capacity} guest{room.capacity > 1 ? "s" : ""}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-foreground">Total Rooms</p>
                    <p className="text-sm text-muted-foreground">
                      {room.totalRooms} room{room.totalRooms > 1 ? "s" : ""} in
                      this category
                    </p>
                  </div>

                  {room.amenities && room.amenities.length > 0 && (
                    <div>
                      <p className="font-medium text-foreground mb-2">
                        Amenities
                      </p>
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
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing & Booking Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Pricing & Booking
                </h3>

                <div className="space-y-4 pl-7">
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      Price per Night
                    </p>
                    <p className="text-3xl font-bold text-primary">
                      {formatPrice(room.pricePerNight)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Excluding taxes and fees
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-foreground mb-2">
                      Current Availability
                    </p>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${getAvailabilityColor()}`}
                        style={{
                          width: `${availabilityPercentage}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {room.roomsBooked} of {room.totalRooms} rooms booked
                    </p>
                  </div>

                  {/* Booking Action Button */}
                  <div className="space-y-3 pt-4">
                    {canManageRooms ? (
                      // Admin/Agent view
                      <>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleEdit}
                            variant="outline"
                            className="flex-1 cursor-pointer"
                            disabled={isDeleting}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => setShowDeleteDialog(true)}
                            variant="destructive"
                            className="flex-1 cursor-pointer"
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Delete
                          </Button>
                        </div>
                        <BookingButton
                          roomId={room.id}
                          price={room.pricePerNight}
                          variant="default"
                          size="lg"
                          className="w-full cursor-pointer"
                          disabled={isDeleting}
                          label={
                            !isAvailable
                              ? "Fully Booked - Book Anyway"
                              : "Book for Customer"
                          }
                        />
                      </>
                    ) : (
                      // Regular user view
                      <>
                        {isBookingDataLoading ? (
                          <Button
                            variant="secondary"
                            className="w-full"
                            size="lg"
                            disabled
                          >
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading booking status...
                          </Button>
                        ) : hasActiveBooking ? (
                          <div className="space-y-2">
                            <div className="rounded-lg bg-muted/50 p-4 border border-border">
                              <p className="text-sm font-medium text-foreground mb-1">
                                You have an active booking
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Status:{" "}
                                <span className="font-medium">
                                  {userBooking?.status}
                                </span>
                              </p>
                              {userBooking?.type === "ROOM" &&
                                userBooking.room?.startDate &&
                                userBooking.room?.endDate && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(
                                      userBooking.room.startDate
                                    ).toLocaleDateString()}{" "}
                                    -
                                    {new Date(
                                      userBooking.room.endDate
                                    ).toLocaleDateString()}
                                  </p>
                                )}
                            </div>
                            <Button
                              variant="outline"
                              className="w-full cursor-pointer hover:text-foreground"
                              size="lg"
                              onClick={() =>
                                router.push(
                                  `/dashboard/bookings/${userBooking.id}`
                                )
                              }
                            >
                              View Booking Details
                            </Button>
                          </div>
                        ) : (
                          <BookingButton
                            roomId={room.id}
                            price={room.pricePerNight}
                            userId={user?.id ? parseInt(user.id) : undefined}
                            variant="default"
                            size="lg"
                            className="w-full cursor-pointer"
                            disabled={!isAvailable && !canManageRooms}
                            label={
                              !isAvailable ? "Fully Booked" : "Book This Room"
                            }
                          />
                        )}
                      </>
                    )}
                  </div>

                  {/* Additional Info */}
                  {!isAvailable && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 border border-amber-200 dark:border-amber-900">
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        💡 This room is currently fully booked. Check back later
                        or try different dates.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="pt-4 border-t border-border">
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">Added:</span>{" "}
                  {new Date(room.createdAt).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span>{" "}
                  {new Date(room.updatedAt).toLocaleDateString()}
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
          description={`Are you sure you want to delete room "${truncatedRoomType}"? This action cannot be undone and will affect all associated bookings.`}
          onConfirm={handleDelete}
          confirmText="Delete Room"
          isDestructive
        />
      </div>
    </TooltipProvider>
  );
}
