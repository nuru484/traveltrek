"use client";
import React, { useEffect } from "react";
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
import { FormRootError } from "@/components/ui/form-root-error";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCreateRoomMutation, useUpdateRoomMutation } from "@/redux/roomApi";
import { useGetAllHotelsQuery } from "@/redux/hotelApi";
import toast from "react-hot-toast";
import { IRoom } from "@/types/room.types";
import { IHotel } from "@/types/hotel.types";
import {
  PhotoUploadField,
  appendPhotoToFormData,
  usePhotoUpload,
} from "@/components/forms/photo-upload-field";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

const roomFormSchema = z.object({
  hotelId: z.number().min(1, "Hotel is required"),
  roomType: z.string().min(1, "Room type is required"),
  // GHS decimal in the form; converted to integer pesewas (×100) on submit
  // and back (÷100) when hydrating edit defaults.
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
      // API pricePerNight is integer pesewas; the form edits GHS decimals.
      pricePerNight: room ? room.pricePerNight / 100 : 0,
      capacity: room?.capacity || 1,
      totalRooms: room?.totalRooms || 1,
      description: room?.description || null,
      amenities: room?.amenities || [],
      roomPhoto: undefined,
    },
  });

  const photo = usePhotoUpload({
    form,
    name: "roomPhoto",
    existingPhoto: room?.photo,
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

  const onSubmit = async (values: RoomFormValues) => {
    try {
      const formData = new FormData();
      formData.append("hotelId", values.hotelId.toString());
      formData.append("roomType", values.roomType);
      // GHS decimal -> integer pesewas for the API.
      formData.append(
        "pricePerNight",
        Math.round(values.pricePerNight * 100).toString()
      );
      formData.append("capacity", values.capacity.toString());
      formData.append("totalRooms", values.totalRooms.toString());
      if (values.description)
        formData.append("description", values.description);
      if (values.amenities && values.amenities.length > 0) {
        values.amenities.forEach((amenity, index) => {
          formData.append(`amenities[${index}]`, amenity);
        });
      }
      appendPhotoToFormData(formData, "roomPhoto", {
        value: values.roomPhoto,
        existingPhoto: room?.photo,
        isEdit: mode === "edit",
        previewUrl: photo.previewUrl,
      });

      if (mode === "create") {
        const response = await createRoom(formData).unwrap();
        toast.success("Room created successfully");
        router.push(`/dashboard/rooms/${response.data.id}/detail`);
      } else {
        if (!room) {
          toast.error("No room to update");
          return;
        }
        await updateRoom({
          id: room.id,
          formData,
        }).unwrap();
        toast.success("Room updated successfully");
        router.push(`/dashboard/rooms/${room.id}/detail`);
      }
    } catch (error) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      const fallback = `Failed to ${mode} room`;

      if (hasFieldErrors && fieldErrors) {
        // Only field names the form actually renders are attached; unknown
        // ones fall through to the root error below.
        const unmatched = applyServerFieldErrors(
          form.setError,
          fieldErrors,
          Object.keys(roomFormSchema.shape)
        );
        if (unmatched.length > 0) {
          form.setError("root", { message: unmatched.join(" ") });
        }
      } else {
        // No field to attach it to: keep the error visible in the form
        // after the toast fades.
        form.setError("root", { message: message || fallback });
      }

      toast.error(message || fallback);
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
            <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        <SelectTrigger className="w-full min-w-0">
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
                              <span className="min-w-0 line-clamp-1 whitespace-normal [overflow-wrap:anywhere]">
                                {hotel.name} ({hotel.destination?.city},{" "}
                                {hotel.destination?.country})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {selectedHotel && (
                      <p className="min-w-0 text-sm text-muted-foreground mt-1 [overflow-wrap:anywhere]">
                        Selected: {selectedHotel.name} (
                        {selectedHotel.destination?.city},{" "}
                        {selectedHotel.destination?.country})
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
                        <SelectTrigger className="w-full min-w-0">
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

              <PhotoUploadField
                control={form.control}
                name="roomPhoto"
                label="Room Photo (Optional)"
                uploadLabel="Upload Room Photo"
                previewAlt="Room photo preview"
                upload={photo}
                disabled={isLoading}
              />

              {/* Server errors that belong to no single field stay visible
                  here after the toast fades. */}
              <FormRootError />

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
