// src/components/tours/tour-form.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Save, Check, ChevronsUpDown, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCreateTourMutation, useUpdateTourMutation } from "@/redux/tourApi";
import { useGetAllDestinationsQuery } from "@/redux/destinationApi";
import toast from "react-hot-toast";
import { ITour } from "@/types/tour.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { cn } from "@/lib/utils";

const tourFormSchema = z.object({
  name: z.string().min(1, "Tour name is required"),
  description: z.string().optional().nullable(),
  type: z.enum(
    ["ADVENTURE", "CULTURAL", "BEACH", "CITY", "WILDLIFE", "CRUISE"],
    {
      message: "Tour type is required",
    }
  ),
  // GHS decimal in the form; converted to integer pesewas (×100) on submit
  // and back (÷100) when hydrating edit defaults.
  price: z.number().min(0, "Price must be a non-negative number"),
  maxGuests: z.number().min(1, "Max guests must be a positive number"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  destinationId: z.number().min(1, "Destination is required"),
  tourPhoto: z.any().optional(),
});

type TourFormValues = z.infer<typeof tourFormSchema>;

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
  const [destinationSearch, setDestinationSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    tour?.photo || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: destinationsData, isLoading: isLoadingDestinations } =
    useGetAllDestinationsQuery({
      limit: 10,
      search: destinationSearch,
    });

  const form = useForm<TourFormValues>({
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

  const handleImageChange = (file: File | undefined) => {
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        form.setError("tourPhoto", {
          type: "manual",
          message: "Please select a valid image file",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        form.setError("tourPhoto", {
          type: "manual",
          message: "Image size should be less than 5MB",
        });
        return;
      }

      // Clean up old preview URL
      if (previewUrl && previewUrl !== tour?.photo) {
        URL.revokeObjectURL(previewUrl);
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      form.setValue("tourPhoto", file);
      form.clearErrors("tourPhoto");
    }
  };

  const removeImage = () => {
    if (previewUrl && previewUrl !== tour?.photo) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    form.setValue("tourPhoto", undefined);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== tour?.photo) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, tour?.photo]);

  const onSubmit = async (values: TourFormValues) => {
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
      if (values.tourPhoto) formData.append("tourPhoto", values.tourPhoto);

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

      if (hasFieldErrors && fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof TourFormValues, {
            message: errorMessage,
          });
        });
        toast.error(message);
      } else {
        toast.error(message || `Failed to ${mode} tour`);
      }
    }
  };

  const isLoading = isCreating || isUpdating;
  const destinations = destinationsData?.data || [];

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

              <FormField
                control={form.control}
                name="destinationId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Destination</FormLabel>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className={cn(
                              "h-10 w-full min-w-0 justify-between text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <span className="min-w-0 flex-1 line-clamp-1 whitespace-normal [overflow-wrap:anywhere]">
                              {field.value
                                ? destinations.find(
                                    (destination) =>
                                      destination.id === field.value
                                  )?.name ||
                                  tour?.destination?.name ||
                                  "Select destination"
                                : "Select destination"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput
                            placeholder="Search destination..."
                            value={destinationSearch}
                            onValueChange={setDestinationSearch}
                          />
                          <CommandEmpty>
                            {isLoadingDestinations
                              ? "Loading destinations..."
                              : "No destination found."}
                          </CommandEmpty>
                          <CommandGroup>
                            {destinations.map((destination) => (
                              <CommandItem
                                key={destination.id}
                                value={destination.name}
                                onSelect={() => {
                                  field.onChange(destination.id);
                                  setOpen(false);
                                  setDestinationSearch("");
                                }}
                                className="items-start"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0 mt-0.5",
                                    destination.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere]">
                                  {destination.name}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
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

              <FormField
                control={form.control}
                name="tourPhoto"
                render={() => (
                  <FormItem>
                    <FormLabel>Tour Photo (Optional)</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {/* Preview */}
                        {previewUrl && (
                          <div className="relative w-24 h-24 mx-auto">
                            <div className="relative w-full h-full rounded-md overflow-hidden border border-muted-foreground/20">
                              <Image
                                src={previewUrl}
                                alt="Tour photo preview"
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
                            className="w-full bg-muted border-dashed border hover:bg-muted/80"
                            disabled={isLoading}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            {previewUrl ? "Change Photo" : "Upload Tour Photo"}
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
