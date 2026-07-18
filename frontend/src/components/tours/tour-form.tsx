// src/components/tours/tour-form.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCreateTourMutation, useUpdateTourMutation } from "@/redux/tourApi";
import toast from "react-hot-toast";
import { ITour } from "@/types/tour.types";
import { DestinationCombobox } from "@/components/forms/destination-combobox";
import {
  PhotoUploadField,
  appendPhotoToFormData,
  usePhotoUpload,
} from "@/components/forms/photo-upload-field";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { tourFormSchema, type ITourFormValues } from "@/validation/tour-validation";



interface ITourFormProps {
  tour?: ITour;
  mode: "create" | "edit";
}

const tourTypes = [
  "ADVENTURE",
  "CULTURAL",
  "BEACH",
  "CITY",
  "WILDLIFE",
  "CRUISE",
] as const;

export function TourForm({ tour, mode }: ITourFormProps) {
  const router = useRouter();
  const [createTour, { isLoading: isCreating }] = useCreateTourMutation();
  const [updateTour, { isLoading: isUpdating }] = useUpdateTourMutation();

  const form = useForm<ITourFormValues>({
    resolver: zodResolver(tourFormSchema),
    defaultValues: {
      name: tour?.name || "",
      description: tour?.description || "",
      type: tour?.type || "ADVENTURE",
      // API price is integer pesewas; the form edits GHS decimals.
      price: tour ? tour.price / 100 : 0,
      maxGuests: tour?.maxGuests || 0,
      startDate: tour?.startDate
        ? tour.startDate.split("T")[0] +
          "T" +
          tour.startDate.split("T")[1].slice(0, 5)
        : "",
      endDate: tour?.endDate
        ? tour.endDate.split("T")[0] +
          "T" +
          tour.endDate.split("T")[1].slice(0, 5)
        : "",
      destinationId: tour?.destination?.id || 0,
      tourPhoto: undefined,
    },
  });

  const photo = usePhotoUpload({
    form,
    name: "tourPhoto",
    existingPhoto: tour?.photo,
  });

  const onSubmit = async (values: ITourFormValues) => {
    try {
      // Multipart body — the 'tourPhoto' file field rides along with the
      // scalar fields (the backend zod schema coerces the stringified ones).
      const formData = new FormData();
      formData.append("name", values.name);
      if (values.description)
        formData.append("description", values.description);
      formData.append("type", values.type);
      // GHS decimal -> integer pesewas for the API.
      formData.append("price", String(Math.round(values.price * 100)));
      formData.append("maxGuests", String(values.maxGuests));
      formData.append(
        "startDate",
        new Date(values.startDate).toISOString()
      );
      formData.append("endDate", new Date(values.endDate).toISOString());
      formData.append("destinationId", String(values.destinationId));
      appendPhotoToFormData(formData, "tourPhoto", {
        value: values.tourPhoto,
        existingPhoto: tour?.photo,
        isEdit: mode === "edit",
        previewUrl: photo.previewUrl,
      });

      if (mode === "create") {
        await createTour(formData).unwrap();
        toast.success("Tour created successfully");
      } else {
        await updateTour({
          id: tour!.id,
          formData,
        }).unwrap();
        toast.success("Tour updated successfully");
      }

      router.push("/dashboard/tours");
    } catch (error) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      const fallback = `Failed to ${mode} tour`;

      if (hasFieldErrors && fieldErrors) {
        // Only field names the form actually renders are attached; unknown
        // ones fall through to the root error below.
        const unmatched = applyServerFieldErrors(
          form.setError,
          fieldErrors,
          Object.keys(tourFormSchema.shape)
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
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tour Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Safari Adventure" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tour Type</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue placeholder="Select tour type" />
                          </SelectTrigger>
                          <SelectContent>
                            {tourTypes.map((type) => (
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
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Explore the wilderness..."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DestinationCombobox
                control={form.control}
                name="destinationId"
                fallbackName={tour?.destination?.name}
              />
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 999.99"
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
                  name="maxGuests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Guests</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 20"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <PhotoUploadField
                control={form.control}
                name="tourPhoto"
                label="Tour Photo (Optional)"
                uploadLabel="Upload Tour Photo"
                previewAlt="Tour photo preview"
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
                  onClick={() => router.push("/dashboard/tours")}
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
                  <Save className="mr-2 h-4 w-4" />
                  {isLoading
                    ? "Saving..."
                    : mode === "create"
                    ? "Create Tour"
                    : "Update Tour"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
