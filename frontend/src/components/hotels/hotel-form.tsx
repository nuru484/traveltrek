"use client";
import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import {
  useCreateHotelMutation,
  useUpdateHotelMutation,
} from "@/redux/hotelApi";
import toast from "react-hot-toast";
import { IHotel } from "@/types/hotel.types";
import { DestinationCombobox } from "@/components/forms/destination-combobox";
import {
  PhotoUploadField,
  appendPhotoToFormData,
  usePhotoUpload,
} from "@/components/forms/photo-upload-field";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { hotelFormSchema, type IHotelFormValues } from "@/validation/hotel-validation";



interface IHotelFormProps {
  hotel?: IHotel;
  mode: "create" | "edit";
}

export function HotelForm({ hotel, mode }: IHotelFormProps) {
  const router = useRouter();
  const [createHotel, { isLoading: isCreating }] = useCreateHotelMutation();
  const [updateHotel, { isLoading: isUpdating }] = useUpdateHotelMutation();

  const form = useForm<IHotelFormValues>({
    resolver: zodResolver(hotelFormSchema),
    defaultValues: {
      name: hotel?.name || "",
      description: hotel?.description || null,
      address: hotel?.address || "",
      phone: hotel?.phone || null,
      starRating: hotel?.starRating || 3,
      amenities: hotel?.amenities || [],
      destinationId: hotel?.destination?.id || 0,
      hotelPhoto: undefined,
    },
  });

  const photo = usePhotoUpload({
    form,
    name: "hotelPhoto",
    existingPhoto: hotel?.photo,
  });

  const onSubmit = async (values: IHotelFormValues) => {
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      if (values.description)
        formData.append("description", values.description);
      formData.append("address", values.address);
      if (values.phone) formData.append("phone", values.phone);
      if (values.starRating)
        formData.append("starRating", values.starRating.toString());
      if (values.amenities && values.amenities.length > 0) {
        values.amenities.forEach((amenity, index) => {
          formData.append(`amenities[${index}]`, amenity);
        });
      }
      formData.append("destinationId", values.destinationId.toString());
      appendPhotoToFormData(formData, "hotelPhoto", {
        value: values.hotelPhoto,
        existingPhoto: hotel?.photo,
        isEdit: mode === "edit",
        previewUrl: photo.previewUrl,
      });

      if (mode === "create") {
        await createHotel(formData).unwrap();
        toast.success("Hotel created successfully");
      } else {
        await updateHotel({
          id: hotel!.id,
          formData,
        }).unwrap();
        toast.success("Hotel updated successfully");
      }

      router.push("/dashboard/hotels");
    } catch (error) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      const fallback = `Failed to ${mode} hotel`;

      if (hasFieldErrors && fieldErrors) {
        // Only field names the form actually renders are attached; unknown
        // ones fall through to the root error below.
        const unmatched = applyServerFieldErrors(
          form.setError,
          fieldErrors,
          Object.keys(hotelFormSchema.shape)
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

  const isLoading = isCreating || isUpdating;

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardContent>
          <Form {...form}>
            <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hotel Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Grand Hotel" {...field} />
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
                        placeholder="e.g., A luxurious hotel with stunning views"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DestinationCombobox
                control={form.control}
                name="destinationId"
                fallbackName={hotel?.destination?.name}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., +233 123 456 789"
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
                name="starRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Star Rating (Optional)</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                        defaultValue={field.value?.toString()}
                      >
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue placeholder="Select star rating" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <SelectItem key={rating} value={rating.toString()}>
                              {rating} Star{rating > 1 ? "s" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        placeholder="e.g., WiFi, Pool, Gym"
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
                name="hotelPhoto"
                label="Hotel Photo (Optional)"
                uploadLabel="Upload Hotel Photo"
                previewAlt="Hotel photo preview"
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
                  className="flex-1 hover:cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 hover:cursor-pointer"
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {mode === "create" ? "Create Hotel" : "Update Hotel"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
