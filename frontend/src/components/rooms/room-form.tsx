"use client";
import React, { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCreateRoomMutation, useUpdateRoomMutation } from "@/redux/roomApi";
import { useGetAllHotelsQuery } from "@/redux/hotelApi";
import toast from "react-hot-toast";
import { IRoom } from "@/types/room.types";
import { IHotel } from "@/types/hotel.types";
import Image from "next/image";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

const roomFormSchema = z.object({
  hotelId: z.number().min(1, "Hotel is required"),
  roomType: z.string().min(1, "Room type is required"),
  pricePerNight: z.number().min(0, "Price must be a positive number"),
  capacity: z.number().min(1, "Capacity must be at least 1"),
  totalRooms: z.number().min(1, "Total rooms must be at least 1"),
  description: z.string().optional().nullable(),
  amenities: z.array(z.string()).optional(),
  roomPhoto: z.any().optional(),
});

type RoomFormValues = z.infer<typeof roomFormSchema>;

interface IRoomFormProps {
  room?: IRoom;
  mode: "create" | "edit";
  hotelId?: number;
}

export function RoomForm({ room, mode, hotelId }: IRoomFormProps) {
  const router = useRouter();
  const [createRoom, { isLoading: isCreating }] = useCreateRoomMutation();
  const [updateRoom, { isLoading: isUpdating }] = useUpdateRoomMutation();
  const { data: hotelsData, isLoading: isHotelsLoading } = useGetAllHotelsQuery(
    {
      limit: 100,
    }
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    room?.photo || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hotels: IHotel[] = React.useMemo(() => {
    return hotelsData?.data || [];
  }, [hotelsData]);

  const getDefaultHotelId = () => {
    if (room?.hotel?.id) {
      return Number(room.hotel.id);
    }
    if (hotelId) {
      return hotelId;
    }
    return 0;
  };

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: {
      hotelId: getDefaultHotelId(),
      roomType: room?.roomType || "",
      pricePerNight: room?.pricePerNight || 0,
      capacity: room?.capacity || 1,
      totalRooms: room?.totalRooms || 1,
      description: room?.description || null,
      amenities: room?.amenities || [],
      roomPhoto: undefined,
    },
  });

  useEffect(() => {
    if (hotelId && hotels.length > 0) {
      const targetHotelId = hotelId;
      const hotelExists = hotels.some((hotel) => hotel.id === targetHotelId);
      if (hotelExists) {
        form.setValue("hotelId", targetHotelId);
      }
    }
  }, [hotelId, hotels, form]);

  const handleImageChange = (file: File | undefined) => {
    if (file) {
      if (!file.type.startsWith("image/")) {
        form.setError("roomPhoto", {
          type: "manual",
          message: "Please select a valid image file",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        form.setError("roomPhoto", {
          type: "manual",
          message: "Image size should be less than 5MB",
        });
        return;
      }

      // Clean up old preview URL
      if (previewUrl && previewUrl !== room?.photo) {
        URL.revokeObjectURL(previewUrl);
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      form.setValue("roomPhoto", file);
      form.clearErrors("roomPhoto");
    }
  };

  const removeImage = () => {
    if (previewUrl && previewUrl !== room?.photo) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    form.setValue("roomPhoto", undefined);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== room?.photo) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, room?.photo]);

  const onSubmit = async (values: RoomFormValues) => {
    try {
      const formData = new FormData();
      formData.append("hotelId", values.hotelId.toString());
      formData.append("roomType", values.roomType);
      formData.append("pricePerNight", values.pricePerNight.toString());
      formData.append("capacity", values.capacity.toString());
      formData.append("totalRooms", values.totalRooms.toString());
      if (values.description)
        formData.append("description", values.description);
      if (values.amenities && values.amenities.length > 0) {
        values.amenities.forEach((amenity, index) => {
          formData.append(`amenities[${index}]`, amenity);
        });
      }
      if (values.roomPhoto) formData.append("roomPhoto", values.roomPhoto);

      if (mode === "create") {
        const response = await createRoom(formData).unwrap();
        toast.success("Room created successfully");
        router.push(`/dashboard/rooms/${response.data.id}/detail`);
      } else {
        await updateRoom({
          id: room!.id,
          formData,
        }).unwrap();
        toast.success("Room updated successfully");
        router.push(`/dashboard/rooms/${room.id}/detail`);
      }
    } catch (error) {
      console.error(`Failed to ${mode} room:`, error);
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      if (hasFieldErrors && fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof RoomFormValues, {
            message: errorMessage,
          });
        });
        toast.error(message);
      } else {
        toast.error(message || `Failed to ${mode} room`);
      }
    }
  };

  const isLoading = isCreating || isUpdating || isHotelsLoading;

  const roomTypes = [
    "Single",
    "Double",
    "Twin",
    "Triple",
    "Suite",
    "Deluxe",
    "Standard",
    "Executive",
    "Presidential",
    "Family",
  ];

  const selectedHotel = hotels.find(
    (hotel) => hotel.id === form.watch("hotelId")
  );

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="hotelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hotel</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                        value={field.value?.toString() || ""}
                        disabled={isHotelsLoading || !!hotelId}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isHotelsLoading
                                ? "Loading hotels..."
                                : "Select hotel"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {hotels.map((hotel) => (
                            <SelectItem
                              key={hotel.id}
                              value={hotel.id.toString()}
                            >
                              {hotel.name} ({hotel?.destination?.city},{" "}
                              {hotel?.destination.country})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {selectedHotel && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selected: {selectedHotel.name} (
                        {selectedHotel.destination.city},{" "}
                        {selectedHotel.destination.country})
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roomType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Type</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select room type" />
                        </SelectTrigger>
                        <SelectContent>
                          {roomTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="pricePerNight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per Night</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 150"
                          min="0"
                          step="0.01"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity (Guests)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 2"
                          min="1"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="totalRooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Rooms</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 10"
                        min="1"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Spacious room with ocean view"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amenities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amenities (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Air Conditioning, TV, Mini Bar"
                        value={field.value?.join(", ") || ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? e.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                              : []
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roomPhoto"
                render={() => (
                  <FormItem>
                    <FormLabel>Room Photo (Optional)</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {/* Preview */}
                        {previewUrl && (
                          <div className="relative w-24 h-24 mx-auto">
                            <div className="relative w-full h-full rounded-md overflow-hidden border-2 border-muted-foreground/20">
                              <Image
                                src={previewUrl}
                                alt="Room photo preview"
                                fill
                                className="object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={removeImage}
                              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors"
                              aria-label="Remove image"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}

                        {/* File Input */}
                        <div className="relative">
                          <Input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleImageChange(e.target.files?.[0])
                            }
                            disabled={isLoading}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-muted border-dashed border-2 hover:bg-muted/80"
                            disabled={isLoading}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            {previewUrl ? "Change Photo" : "Upload Room Photo"}
                          </Button>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                          Supported formats: JPG, PNG, GIF (Max 5MB)
                        </p>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard/hotels")}
                  disabled={isLoading}
                  className="flex-1 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 cursor-pointer"
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {mode === "create" ? "Create Room" : "Update Room"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
