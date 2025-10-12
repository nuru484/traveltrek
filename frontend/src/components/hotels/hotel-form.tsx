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
import { Loader2, Upload, X, Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCreateHotelMutation,
  useUpdateHotelMutation,
} from "@/redux/hotelApi";
import { useGetAllDestinationsQuery } from "@/redux/destinationApi";
import toast from "react-hot-toast";
import { IHotel } from "@/types/hotel.types";
import Image from "next/image";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { cn } from "@/lib/utils";

const hotelFormSchema = z.object({
  name: z.string().min(1, "Hotel name is required"),
  description: z.string().optional().nullable(),
  address: z.string().min(1, "Address is required"),
  phone: z.string().optional().nullable(),
  starRating: z.number().min(1).max(5).optional(),
  amenities: z.array(z.string()).optional(),
  destinationId: z.number().min(1, "Destination is required"),
  hotelPhoto: z.any().optional(),
});

type HotelFormValues = z.infer<typeof hotelFormSchema>;

interface IHotelFormProps {
  hotel?: IHotel;
  mode: "create" | "edit";
}

export function HotelForm({ hotel, mode }: IHotelFormProps) {
  const router = useRouter();
  const [createHotel, { isLoading: isCreating }] = useCreateHotelMutation();
  const [updateHotel, { isLoading: isUpdating }] = useUpdateHotelMutation();
  const [destinationSearch, setDestinationSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    hotel?.photo || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: destinationsData, isLoading: isLoadingDestinations } =
    useGetAllDestinationsQuery({
      limit: 10,
      search: destinationSearch,
    });

  const form = useForm<HotelFormValues>({
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

  const handleImageChange = (file: File | undefined) => {
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        form.setError("hotelPhoto", {
          type: "manual",
          message: "Please select a valid image file",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        form.setError("hotelPhoto", {
          type: "manual",
          message: "Image size should be less than 5MB",
        });
        return;
      }

      // Clean up old preview URL
      if (previewUrl && previewUrl !== hotel?.photo) {
        URL.revokeObjectURL(previewUrl);
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      form.setValue("hotelPhoto", file);
      form.clearErrors("hotelPhoto");
    }
  };

  const removeImage = () => {
    if (previewUrl && previewUrl !== hotel?.photo) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    form.setValue("hotelPhoto", undefined);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== hotel?.photo) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, hotel?.photo]);

  const onSubmit = async (values: HotelFormValues) => {
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
      if (values.hotelPhoto) formData.append("hotelPhoto", values.hotelPhoto);

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
      console.error(`Failed to ${mode} hotel:`, error);
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      if (hasFieldErrors && fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof HotelFormValues, {
            message: errorMessage,
          });
        });
        toast.error(message);
      } else {
        toast.error(message || `Failed to ${mode} hotel`);
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
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? destinations.find(
                                  (destination) =>
                                    destination.id === field.value
                                )?.name ||
                                hotel?.destination?.name ||
                                "Select destination"
                              : "Select destination"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
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
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    destination.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{destination.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {destination.city &&
                                      `${destination.city}, `}
                                    {destination.country}
                                  </span>
                                </div>
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
                        <SelectTrigger>
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

              <FormField
                control={form.control}
                name="hotelPhoto"
                render={() => (
                  <FormItem>
                    <FormLabel>Hotel Photo (Optional)</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {/* Preview */}
                        {previewUrl && (
                          <div className="relative w-24 h-24 mx-auto">
                            <div className="relative w-full h-full rounded-md overflow-hidden border-2 border-muted-foreground/20">
                              <Image
                                src={previewUrl}
                                alt="Hotel photo preview"
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
                            {previewUrl ? "Change Photo" : "Upload Hotel Photo"}
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