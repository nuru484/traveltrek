// src/components/customers/CustomerForm.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Input } from "@/components/ui/input";
import { Loader2, X, Upload } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
} from "@/redux/customerApi";
import { ICustomer } from "@/types/customer.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { shouldRemovePhoto } from "@/utils/photo-removal";
import {
  customerCreateFormSchema,
  customerUpdateFormSchema,
  ICustomerCreateFormSchema,
} from "@/validation/customer-validation";

interface ICustomerFormProps {
  mode: "create" | "edit";
  customer?: ICustomer;
  /**
   * True when the customer is editing their OWN profile. Email/phone are
   * login identifiers — the backend 400s self-service changes here, so the
   * fields are replaced with a note pointing at Settings → Contact (the
   * verified change flows). Staff editing a customer keep the fields.
   */
  isSelf?: boolean;
  /** Where to go after a successful save (defaults to the customers list). */
  redirectTo?: string;
}

/**
 * Staff create is JSON (the backend create route has no upload middleware);
 * edit is multipart so a profile picture can be uploaded. NO password field:
 * only the account owner manages a password, via Settings → Password
 * (POST /auth/change-password).
 */
export default function CustomerForm({
  mode,
  customer,
  isSelf = false,
  redirectTo,
}: ICustomerFormProps) {
  const router = useRouter();

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    customer?.profilePicture || null
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [createCustomer, { isLoading: isCreating }] =
    useCreateCustomerMutation();
  const [updateCustomer, { isLoading: isUpdating }] =
    useUpdateCustomerMutation();

  const defaultValues: ICustomerCreateFormSchema = useMemo(
    () => ({
      name: customer?.name || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      address: customer?.address || "",
    }),
    [customer]
  );

  const form = useForm<ICustomerCreateFormSchema>({
    // The update schema is the create schema without the contact refinement;
    // the cast reconciles the two zod output types for react-hook-form.
    resolver: zodResolver(
      mode === "create" ? customerCreateFormSchema : customerUpdateFormSchema
    ) as Resolver<ICustomerCreateFormSchema>,
    defaultValues,
  });

  const [pictureFile, setPictureFile] = useState<File | undefined>(undefined);

  const handleImageChange = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    if (previewUrl && previewUrl !== customer?.profilePicture) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(URL.createObjectURL(file));
    setPictureFile(file);
  };

  const removeImage = () => {
    if (previewUrl && previewUrl !== customer?.profilePicture) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPictureFile(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== customer?.profilePicture) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, customer?.profilePicture]);

  const onSubmit = async (values: ICustomerCreateFormSchema) => {
    try {
      if (mode === "create") {
        const res = await createCustomer({
          name: values.name,
          ...(values.email ? { email: values.email } : {}),
          ...(values.phone ? { phone: values.phone } : {}),
          ...(values.address ? { address: values.address } : {}),
        }).unwrap();
        toast.success("Customer created successfully");
        router.push(redirectTo ?? `/dashboard/customers/${res.data.id}`);
      } else {
        const formData = new FormData();
        formData.append("name", values.name);
        // Self-service edits never write the login identifiers — the backend
        // 400s changed values; Settings → Contact is the verified path.
        if (!isSelf) {
          if (values.email) formData.append("email", values.email);
          if (values.phone) formData.append("phone", values.phone);
        }
        if (values.address) formData.append("address", values.address);
        if (pictureFile) {
          formData.append("profilePicture", pictureFile);
        } else if (
          shouldRemovePhoto({
            existingPhoto: customer?.profilePicture,
            isEdit: true,
            newFile: pictureFile,
            previewUrl,
          })
        ) {
          // Empty string = the API's remove-photo signal.
          formData.append("profilePicture", "");
        }

        const res = await updateCustomer({
          customerId: customer!.id,
          data: formData,
        }).unwrap();
        toast.success("Customer updated successfully");
        router.push(redirectTo ?? `/dashboard/customers/${res.data.id}`);
      }
    } catch (error) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      if (hasFieldErrors && fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof ICustomerCreateFormSchema, {
            message: errorMessage,
          });
        });
      }

      toast.error(message || "Operation failed");
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isSelf && (
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  Your email and phone number are how you sign in, so they
                  can&apos;t be edited here. Change them securely under{" "}
                  <Link
                    href="/dashboard/settings/contact"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Settings → Contact
                  </Link>
                  .
                </p>
              )}

              <div
                className={
                  isSelf
                    ? "hidden"
                    : "grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-4"
                }
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="customer@example.com"
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
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+233 54 000 0000"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {mode === "create" && (
                <p className="text-xs text-muted-foreground">
                  One contact is enough — email or phone. Accounts start
                  passwordless: the customer signs in with a one-time code and
                  can set a password later under Settings.
                </p>
              )}

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123 Main Street, City, Region"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {mode === "edit" && (
                <FormItem>
                  <FormLabel>Profile Picture (Optional)</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      {previewUrl && (
                        <div className="relative w-24 h-24 mx-auto">
                          <div className="relative w-full h-full rounded-full overflow-hidden border border-muted-foreground/20">
                            <Image
                              src={previewUrl}
                              alt="Profile preview"
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
                          {previewUrl ? "Change Picture" : "Upload Picture"}
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground text-center">
                        Supported formats: JPG, PNG, GIF (Max 5MB)
                      </p>
                    </div>
                  </FormControl>
                </FormItem>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
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
                  {mode === "create" ? "Create Customer" : "Update Customer"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
