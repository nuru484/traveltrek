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
import { Loader2, Upload, X, Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCreateFlightMutation,
  useUpdateFlightMutation,
} from "@/redux/flightApi";
import { useGetAllDestinationsQuery } from "@/redux/destinationApi";
import toast from "react-hot-toast";
import { IFlight } from "@/types/flight.types";
import Image from "next/image";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { IFlightClass } from "@/types/flight.types";
import { IDestination } from "@/types/destination.types";
import { cn } from "@/lib/utils";

const flightFormSchema = z.object({
  flightNumber: z.string().min(1, "Flight number is required"),
  airline: z.string().min(1, "Airline is required"),
  departure: z.string().min(1, "Departure date is required"),
  arrival: z.string().min(1, "Arrival date is required"),
  originId: z.number().min(1, "Origin is required"),
  destinationId: z.number().min(1, "Destination is required"),
  price: z.number().min(0, "Price must be a positive number"),
  flightClass: z.enum(IFlightClass, {
    message: "Flight class is required",
  }),
  stops: z.number().min(0, "Stops must be a non-negative number").optional(),
  capacity: z
    .number()
    .min(0, "Capacity (Seats Available) must be a non-negative number"),
  flightPhoto: z.any().optional(),
});

type FlightFormValues = z.infer<typeof flightFormSchema>;

interface IFlightFormProps {
  flight?: IFlight;
  mode: "create" | "edit";
}

const flightClasses = [
  "First",
  "Economy",
  "Premium Economy",
  "Business",
] as const;

export function FlightForm({ flight, mode }: IFlightFormProps) {
  const router = useRouter();
  const [createFlight, { isLoading: isCreating }] = useCreateFlightMutation();
  const [updateFlight, { isLoading: isUpdating }] = useUpdateFlightMutation();

  const [originSearch, setOriginSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [originOpen, setOriginOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);

  const { data: originsData, isLoading: isOriginsLoading } =
    useGetAllDestinationsQuery({ limit: 10, search: originSearch });

  const { data: destinationsData, isLoading: isDestinationsLoading } =
    useGetAllDestinationsQuery({ limit: 10, search: destinationSearch });

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    flight?.photo || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const origins: IDestination[] = React.useMemo(() => {
    return originsData?.data || [];
  }, [originsData]);

  const destinations: IDestination[] = React.useMemo(() => {
    return destinationsData?.data || [];
  }, [destinationsData]);

  const form = useForm<FlightFormValues>({
    resolver: zodResolver(flightFormSchema),
    defaultValues: {
      flightNumber: flight?.flightNumber || "",
      airline: flight?.airline || "",
      departure: flight?.departure
        ? flight.departure.split("T")[0] +
          "T" +
          flight.departure.split("T")[1].slice(0, 5)
        : "",
      arrival: flight?.arrival
        ? flight.arrival.split("T")[0] +
          "T" +
          flight.arrival.split("T")[1].slice(0, 5)
        : "",
      originId: flight?.originId || 0,
      destinationId: flight?.destinationId || 0,
      price: flight?.price || 0,
      flightClass: flight?.flightClass || IFlightClass.ECONOMY,
      stops: flight?.stops || 0,
      capacity: flight?.seatsAvailable || 0,
      flightPhoto: undefined,
    },
  });

  const handleImageChange = (file: File | undefined) => {
    if (file) {
      if (!file.type.startsWith("image/")) {
        form.setError("flightPhoto", {
          type: "manual",
          message: "Please select a valid image file",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        form.setError("flightPhoto", {
          type: "manual",
          message: "Image size should be less than 5MB",
        });
        return;
      }

      if (previewUrl && previewUrl !== flight?.photo) {
        URL.revokeObjectURL(previewUrl);
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      form.setValue("flightPhoto", file);
      form.clearErrors("flightPhoto");
    }
  };

  const removeImage = () => {
    if (previewUrl && previewUrl !== flight?.photo) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    form.setValue("flightPhoto", undefined);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== flight?.photo) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, flight?.photo]);

  const onSubmit = async (values: FlightFormValues) => {
    try {
      const formData = new FormData();
      formData.append("flightNumber", values.flightNumber);
      formData.append("airline", values.airline);
      formData.append("departure", new Date(values.departure).toISOString());
      formData.append("arrival", new Date(values.arrival).toISOString());
      formData.append("originId", values.originId.toString());
      formData.append("destinationId", values.destinationId.toString());
      formData.append("price", values.price.toString());
      formData.append("flightClass", values.flightClass);
      if (values.stops !== undefined)
        formData.append("stops", values.stops.toString());
      formData.append("capacity", values.capacity.toString());
      if (values.flightPhoto)
        formData.append("flightPhoto", values.flightPhoto);

      if (mode === "create") {
        await createFlight(formData).unwrap();
        toast.success("Flight created successfully");
      } else {
        await updateFlight({
          id: flight!.id,
          formData,
        }).unwrap();
        toast.success("Flight updated successfully");
      }

      router.push("/dashboard/flights");
    } catch (error) {
      console.error(`Failed to ${mode} flight:`, error);
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      if (hasFieldErrors && fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof FlightFormValues, {
            message: errorMessage,
          });
        });
        toast.error(message);
      } else {
        toast.error(message || `Failed to ${mode} flight`);
      }
    }
  };

  const isLoading = isCreating || isUpdating;

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="flightNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., AA123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="airline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Airline</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Gbewaa Airlines" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="departure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departure</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="arrival"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arrival</FormLabel>
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
                  name="originId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Origin</FormLabel>
                      <Popover open={originOpen} onOpenChange={setOriginOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={originOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? origins.find(
                                    (origin) => origin.id === field.value
                                  )?.name || "Select origin"
                                : "Select origin"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search origin..."
                              value={originSearch}
                              onValueChange={setOriginSearch}
                            />
                            <CommandEmpty>
                              {isOriginsLoading
                                ? "Loading origins..."
                                : "No origin found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {origins.map((origin) => (
                                <CommandItem
                                  key={origin.id}
                                  value={origin.name}
                                  onSelect={() => {
                                    field.onChange(origin.id);
                                    setOriginOpen(false);
                                    setOriginSearch("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      origin.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{origin.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {origin.city && `${origin.city}, `}
                                      {origin.country}
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
                  name="destinationId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Destination</FormLabel>
                      <Popover
                        open={destinationOpen}
                        onOpenChange={setDestinationOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={destinationOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? destinations.find(
                                    (destination) =>
                                      destination.id === field.value
                                  )?.name || "Select destination"
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
                              {isDestinationsLoading
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
                                    setDestinationOpen(false);
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
                          placeholder="e.g., 299.99"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="flightClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flight Class</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select flight class" />
                          </SelectTrigger>
                          <SelectContent>
                            {flightClasses.map((classType) => (
                              <SelectItem key={classType} value={classType}>
                                {classType}
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

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="stops"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stops (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
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
                      <FormLabel>Capacity (Seats Available)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 150"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
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
                name="flightPhoto"
                render={() => (
                  <FormItem>
                    <FormLabel>Flight Photo (Optional)</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {/* Preview */}
                        {previewUrl && (
                          <div className="relative w-24 h-24 mx-auto">
                            <div className="relative w-full h-full rounded-md overflow-hidden border-2 border-muted-foreground/20">
                              <Image
                                src={previewUrl}
                                alt="Flight photo preview"
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
                            {previewUrl
                              ? "Change Photo"
                              : "Upload Flight Photo"}
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
                  onClick={() => router.push("/dashboard/flights")}
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
                  {mode === "create" ? "Create Flight" : "Update Flight"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
