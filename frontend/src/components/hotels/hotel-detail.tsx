// src/components/hotels/hotel-detail.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { useDeleteHotelMutation } from "@/redux/hotelApi";
import { useGetAllUserBookingsQuery } from "@/redux/bookingApi";
import { IHotel } from "@/types/hotel.types";
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
  Home,
  MapPin,
  Edit,
  Trash2,
  Star,
  Bed,
  MoreHorizontal,
  Plus,
  Phone,
  Eye,
  Bookmark,
  DoorOpen,
} from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import toast from "react-hot-toast";
import Image from "next/image";
import { BookingButton } from "../bookings/BookingButton";

interface IHotelDetailProps {
  hotel: IHotel;
}

export function HotelDetail({ hotel }: IHotelDetailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";
  const [deleteHotel, { isLoading: isDeleting }] = useDeleteHotelMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: bookingsData,
    isError: isBookingsError,
    error: bookingsError,
  } = useGetAllUserBookingsQuery(
    { userId: user?.id, params: { page: 1, limit: 1000 } },
    { skip: !user }
  );

  useEffect(() => {
    if (isBookingsError) {
      const { message } = extractApiErrorMessage(bookingsError);
      console.error("Failed to fetch Bookings:", bookingsError);
      toast.error(message || "Failed to load bookings");
    }
  }, [isBookingsError, bookingsError]);

  const handleEdit = () => {
    router.push(`/admin-dashboard/hotels/${hotel.id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteHotel(hotel.id).unwrap();
      toast.success("Hotel deleted successfully");
      setShowDeleteDialog(false);
      router.push(
        pathname.startsWith("/admin-dashboard")
          ? "/admin-dashboard/hotels"
          : "/dashboard/hotels"
      );
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete hotel:", error);
      toast.error(message || "Failed to delete hotel");
    }
  };

  const handleRoomView = (roomId: number) => {
    router.push(`/dashboard/rooms/${roomId}/detail`);
  };

  const handleCreateRoom = () => {
    router.push(`/dashboard/hotels/${hotel.id}/create-room`);
  };

  const isRoomBooked = (roomId: number) => {
    return bookingsData?.data.some(
      (booking) =>
        booking.room?.id === roomId &&
        booking.userId === parseInt(user?.id || "0")
    );
  };

  const truncatedHotelName =
    hotel.name.length > 50 ? `${hotel.name.slice(0, 47)}...` : hotel.name;

  const availableRooms = hotel.rooms?.length || 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section with Hotel Image */}
        <Card className="overflow-hidden shadow-sm">
          {hotel.photo && (
            <div className="relative w-full h-48 sm:h-56 md:h-64 lg:h-80 xl:h-96">
              <Image
                src={hotel.photo}
                alt={hotel.name}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

              {isAdmin && (
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
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
                        Edit Hotel
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={isDeleting}
                        className="text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Hotel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-white/90 text-black"
                    >
                      {hotel.starRating} Star{hotel.starRating > 1 ? "s" : ""}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-white/90 text-black"
                    >
                      {availableRooms} Room{availableRooms !== 1 ? "s" : ""}{" "}
                      Available
                    </Badge>
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white line-clamp-2">
                    {hotel.name}
                  </h1>
                  <p className="text-sm sm:text-base lg:text-lg text-white/90">
                    {/* {hotel.destination?.city}, {hotel.destination?.country} */}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Location Information */}
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground mb-2">Address</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {hotel.address}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Destination */}
          {hotel.destination && (
            <Card className="border-l-4 border-l-secondary">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-secondary-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground mb-2">
                      Destination
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {hotel.destination.name} | {hotel.destination?.country}
                    </p>

                    {hotel.destination.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {hotel.destination.description}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Star Rating & Contact */}
          <Card className="border-l-4 border-l-accent">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Star className="h-5 w-5 text-accent-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground mb-1">
                      Star Rating
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      {hotel.starRating} Star{hotel.starRating > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {hotel.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">
                        Contact
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {hotel.phone}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Description & Amenities */}
          <Card className="border-l-4 border-l-muted sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <Home className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {hotel.description && (
                    <div className="mb-4">
                      <p className="font-semibold text-foreground mb-2">
                        Description
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {hotel.description}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="font-semibold text-foreground mb-2">
                      Amenities
                    </p>
                    {hotel.amenities.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {hotel.amenities.slice(0, 3).map((amenity, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs"
                          >
                            {amenity}
                          </Badge>
                        ))}
                        {hotel.amenities.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{hotel.amenities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No amenities listed
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Rooms Section */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
                <Bed className="h-5 w-5" />
                Available Rooms ({availableRooms})
              </h3>
              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleCreateRoom}
                      size="sm"
                      className="cursor-pointer"
                      disabled={isDeleting}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Add Room</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create new room for this hotel</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {hotel.rooms && hotel.rooms.length > 0 ? (
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {hotel.rooms.map((room) => {
                  const roomBooked = isRoomBooked(room.id);

                  return (
                    <Card
                      key={room.id}
                      className="hover:shadow-lg transition-all duration-300 hover:scale-[1.01] group overflow-hidden"
                    >
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row h-full">
                          {/* Room Image */}
                          <div className="relative w-full sm:w-2/5 h-40 sm:h-auto flex-shrink-0">
                            {room.photo ? (
                              <Image
                                src={room.photo}
                                alt={room.roomType}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 100vw, 40vw"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                <DoorOpen className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
                          </div>

                          {/* Room Information */}
                          <div className="flex-1 p-4 flex flex-col">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-foreground text-base mb-1 truncate">
                                  {room.roomType}
                                </h4>
                                {room.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {room.description}
                                  </p>
                                )}
                              </div>

                              <div className="text-right flex-shrink-0 ml-4">
                                <p className="text-lg font-bold text-primary">
                                  ₵{room.price.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  per night
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 mt-auto flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRoomView(room.id)}
                                className="flex-1 sm:flex-none sm:min-w-[80px] group-hover:border-primary/50 transition-colors cursor-pointer"
                              >
                                <Eye className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">View</span>
                                <span className="sm:hidden">Details</span>
                              </Button>

                              {isAdmin ? (
                                <BookingButton
                                  roomId={room.id}
                                  price={room.price}
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 sm:flex-none sm:min-w-[100px] cursor-pointer"
                                  disabled={isDeleting}
                                  label="Book for User"
                                />
                              ) : (
                                <>
                                  {roomBooked ? (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="flex-1 sm:flex-none sm:min-w-[100px]"
                                      disabled
                                    >
                                      <Bookmark className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                      Already Booked
                                    </Button>
                                  ) : (
                                    <BookingButton
                                      roomId={room.id}
                                      price={room.price}
                                      userId={parseInt(user?.id || "0")}
                                      variant="default"
                                      size="sm"
                                      className="flex-1 sm:flex-none sm:min-w-[100px] cursor-pointer"
                                      label="Book Now"
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <Bed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  No rooms currently available
                </p>
                {isAdmin && (
                  <Button
                    onClick={handleCreateRoom}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={isDeleting}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Room
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <ConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Hotel"
          description={`Are you sure you want to delete hotel "${truncatedHotelName}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />
      </div>
    </TooltipProvider>
  );
}
