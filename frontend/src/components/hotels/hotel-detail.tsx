// src/components/hotels/hotel-detail.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { RootState } from "@/redux/store";
import { useDeleteHotelMutation } from "@/redux/hotelApi";
import { useGetAllUserBookingsQuery } from "@/redux/bookingApi";
import { IHotel } from "@/types/hotel.types";
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
  ImageOff,
  FileText,
  Calendar,
  Building2,
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

  const formatDate = (date: string | Date) => {
    return format(new Date(date), "MMM dd, yyyy");
  };

  const formatDateLong = (date: string | Date) => {
    return format(new Date(date), "EEEE, MMMM dd, yyyy 'at' h:mm a");
  };

  const truncatedHotelName =
    hotel.name.length > 50 ? `${hotel.name.slice(0, 47)}...` : hotel.name;

  const availableRooms = hotel.rooms?.length || 0;

  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6">
        {/* Hero Section with Hotel Image */}
        <Card className="overflow-hidden border-0 shadow-md">
          {hotel.photo ? (
            <div className="relative w-full h-[300px] md:h-[400px]">
              <Image
                src={hotel.photo}
                alt={hotel.name}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

              {isAdmin && (
                <div className="absolute top-4 right-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="bg-white/95 hover:bg-white text-black shadow-lg cursor-pointer h-9 w-9"
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
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge
                        variant="secondary"
                        className="bg-white/95 text-black"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        {hotel.starRating} Star{hotel.starRating > 1 ? "s" : ""}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="bg-white/95 text-black"
                      >
                        <Bed className="h-3 w-3 mr-1" />
                        {availableRooms} Room{availableRooms !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                      {hotel.name}
                    </h1>
                    {hotel.destination && (
                      <div className="flex items-center gap-2 text-white/90">
                        <MapPin className="h-4 w-4" />
                        <span className="text-base md:text-lg">
                          {hotel.destination.city
                            ? `${hotel.destination.city}, `
                            : ""}
                          {hotel.destination.country}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Fallback for no image
            <div className="relative w-full h-[200px] bg-gradient-to-br from-primary/10 via-primary/5 to-background">
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageOff className="h-16 w-16 text-muted-foreground/30" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-background/80 to-transparent">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="outline">
                        <Star className="h-3 w-3 mr-1" />
                        {hotel.starRating} Star{hotel.starRating > 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline">
                        <Bed className="h-3 w-3 mr-1" />
                        {availableRooms} Room{availableRooms !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                      {hotel.name}
                    </h1>
                    {hotel.destination && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="text-base md:text-lg">
                          {hotel.destination.city
                            ? `${hotel.destination.city}, `
                            : ""}
                          {hotel.destination.country}
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
          )}
        </Card>

        {/* Content Section */}
        <Card className="shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="space-y-6">
              {/* Description Section */}
              {hotel.description && (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold text-foreground">
                        About
                      </h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {hotel.description}
                    </p>
                  </div>

                  <Separator />
                </>
              )}

              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Address
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {hotel.address}
                    </p>
                  </div>
                </div>

                {hotel.destination && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <Building2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Destination
                      </p>
                      <p className="text-base font-semibold text-foreground truncate">
                        {hotel.destination.name}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Star className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Rating
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {hotel.starRating} Star{hotel.starRating > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {hotel.phone && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <Phone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Contact
                      </p>
                      <p className="text-base font-semibold text-foreground truncate">
                        {hotel.phone}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <Bed className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Available Rooms
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {availableRooms} Room{availableRooms !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {hotel.createdAt && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Added
                      </p>
                      <p className="text-base font-semibold text-foreground truncate">
                        {formatDate(hotel.createdAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Amenities Section */}
              {hotel.amenities && hotel.amenities.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Home className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold text-foreground">
                        Amenities
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {hotel.amenities.map((amenity, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-sm py-1 px-3"
                        >
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Metadata Footer */}
              {hotel.createdAt && (
                <div className="pt-4 border-t">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Created:</span>
                      <span>{formatDateLong(hotel.createdAt)}</span>
                    </div>
                    {hotel.updatedAt && hotel.createdAt !== hotel.updatedAt && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">Last updated:</span>
                          <span>{formatDateLong(hotel.updatedAt)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Available Rooms Section */}
        <Card className="shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Bed className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">
                  Available Rooms ({availableRooms})
                </h2>
              </div>
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
                                  ₵{room.pricePerNight.toLocaleString()}
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
                                  price={room.pricePerNight}
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
                                      price={room.pricePerNight}
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
              <div className="text-center py-12">
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
          description={`Are you sure you want to delete "${truncatedHotelName}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />
      </div>
    </TooltipProvider>
  );
}
