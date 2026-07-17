"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
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
import { Loader2, X, Upload } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  useCreateDestinationMutation,
  useUpdateDestinationMutation,
} from "@/redux/destinationApi";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { shouldRemovePhoto } from "@/utils/photo-removal";
import { IDestination } from "@/types/destination.types";

const destinationFormSchema = z.object({
  name: z.string().min(1, "Destination name is required"),
  description: z.string().optional().nullable(),
  country: z.string().min(1, "Country is required"),
  city: z.string().optional().nullable(),
  destinationPhoto: z.any().optional(),
});

type DestinationFormValues = z.infer<typeof destinationFormSchema>;

interface IDestinationFormProps {
  destination?: IDestination;
  mode: "create" | "edit";
}

export default function DestinationForm({
  destination,
  mode,
}: IDestinationFormProps) {
  const router = useRouter();

  const [createDestination, { isLoading: isCreating }] =
    useCreateDestinationMutation();
  const [updateDestination, { isLoading: isUpdating }] =
    useUpdateDestinationMutation();

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    destination?.photo || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultValues: Partial<DestinationFormValues> = useMemo(
    () => ({
      name: destination?.name || "",
      description: destination?.description || "",
      country: destination?.country || "",
      city: destination?.city || "",
      destinationPhoto: undefined,
    }),
    [destination]
  );

  const form = useForm<DestinationFormValues>({
    resolver: zodResolver(destinationFormSchema),
    defaultValues,
  });

  const handleImageChange = (file: File | undefined) => {
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        form.setError("destinationPhoto", {
          type: "manual",
          message: "Please select a valid image file",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        form.setError("destinationPhoto", {
          type: "manual",
          message: "Image size should be less than 5MB",
        });
        return;
      }

      // Clean up old preview URL
      if (previewUrl && previewUrl !== destination?.photo) {
        URL.revokeObjectURL(previewUrl);
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      form.setValue("destinationPhoto", file);
      form.clearErrors("destinationPhoto");
    }
  };

  const removeImage = () => {
    if (previewUrl && previewUrl !== destination?.photo) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    form.setValue("destinationPhoto", undefined);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== destination?.photo) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, destination?.photo]);

  const onSubmit = async (values: DestinationFormValues) => {
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      if (values.description)
        formData.append("description", values.description);
      formData.append("country", values.country);
      if (values.city) formData.append("city", values.city);
      if (values.destinationPhoto) {
        formData.append("destinationPhoto", values.destinationPhoto);
      } else if (
        shouldRemovePhoto({
          existingPhoto: destination?.photo,
          isEdit: mode === "edit",
          newFile: values.destinationPhoto,
          previewUrl,
        })
      ) {
        // Empty string = the API's remove-photo signal.
        formData.append("destinationPhoto", "");
      }

      if (mode === "create") {
        await createDestination(formData).unwrap();
        toast.success("Destination created successfully");
      } else {
        await updateDestination({
          id: destination!.id,
          formData,
        }).unwrap();
        toast.success("Destination updated successfully");
      }

      router.push("/dashboard/destinations");
    } catch (error) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      const fallback = "Operation failed";

      if (hasFieldErrors && fieldErrors) {
        // Only field names the form actually renders are attached; unknown
        // ones fall through to the root error below.
        const unmatched = applyServerFieldErrors(
          form.setError,
          fieldErrors,
          Object.keys(destinationFormSchema.shape)
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
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Tamale" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., The City of Light"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Country and City */}
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., France" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Paris"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Photo Upload */}
              <FormField
                control={form.control}
                name="destinationPhoto"
                render={() => (
                  <FormItem>
                    <FormLabel>Destination Photo (Optional)</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {/* Preview */}
                        {previewUrl && (
                          <div className="relative w-24 h-24 mx-auto">
                            <div className="relative w-full h-full rounded-md overflow-hidden border border-muted-foreground/20">
                              <Image
                                src={previewUrl}
                                alt="Destination preview"
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
                            {previewUrl
                              ? "Change Photo"
                              : "Upload Destination Photo"}
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

              {/* Server errors that belong to no single field stay visible
                  here after the toast fades. */}
              <FormRootError />

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard/destinations")}
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
                  {mode === "create"
                    ? "Create Destination"
                    : "Update Destination"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
