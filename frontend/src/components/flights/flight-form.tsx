"use client";
import React, { useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
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
  useCreateFlightMutation,
  useUpdateFlightMutation,
} from "@/redux/flightApi";
import { useGetAllDestinationsQuery } from "@/redux/destinationApi";
import toast from "react-hot-toast";
import { IFlight } from "@/types/flight.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { shouldRemovePhoto } from "@/utils/photo-removal";
import { IDestination } from "@/types/destination.types";
import {
  flightFormSchema,
  IFlightFormValues,
} from "@/validation/flights-validation";
import {
  buildFlightFormData,
  flightFormDefaults,
  getSelectionDisplayText,
} from "./flight-form-logic";
import { DestinationCombobox } from "./destination-combobox";
import { FlightPhotoField } from "./flight-photo-field";

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

  const form = useForm<IFlightFormValues>({
    resolver: zodResolver(flightFormSchema),
    defaultValues: flightFormDefaults(flight),
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

  const onSubmit = async (values: IFlightFormValues) => {
    try {
      const formData = buildFlightFormData(values, {
        removePhoto: shouldRemovePhoto({
          existingPhoto: flight?.photo,
          isEdit: mode === "edit",
          newFile: values.flightPhoto,
          previewUrl,
        }),
      });

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
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      if (hasFieldErrors && fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof IFlightFormValues, {
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
                    <DestinationCombobox
                      label="Origin"
                      value={field.value}
                      displayText={getSelectionDisplayText(
                        field.value,
                        flight?.origin,
                        origins,
                        "Select origin"
                      )}
                      open={originOpen}
                      onOpenChange={setOriginOpen}
                      search={originSearch}
                      onSearchChange={setOriginSearch}
                      searchPlaceholder="Search origin..."
                      options={origins}
                      isLoading={isOriginsLoading}
                      loadingText="Loading origins..."
                      emptyText="No origin found."
                      onSelect={(id) => {
                        field.onChange(id);
                        setOriginOpen(false);
                        setOriginSearch("");
                      }}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="destinationId"
                  render={({ field }) => (
                    <DestinationCombobox
                      label="Destination"
                      value={field.value}
                      displayText={getSelectionDisplayText(
                        field.value,
                        flight?.destination,
                        destinations,
                        "Select destination"
                      )}
                      open={destinationOpen}
                      onOpenChange={setDestinationOpen}
                      search={destinationSearch}
                      onSearchChange={setDestinationSearch}
                      searchPlaceholder="Search destination..."
                      options={destinations}
                      isLoading={isDestinationsLoading}
                      loadingText="Loading destinations..."
                      emptyText="No destination found."
                      showLocationLine
                      onSelect={(id) => {
                        field.onChange(id);
                        setDestinationOpen(false);
                        setDestinationSearch("");
                      }}
                    />
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
                          <SelectTrigger className="w-full min-w-0">
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
                      <FlightPhotoField
                        previewUrl={previewUrl}
                        isLoading={isLoading}
                        fileInputRef={fileInputRef}
                        onImageChange={handleImageChange}
                        onRemove={removeImage}
                      />
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
