// src/components/users/UserForm.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
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
  useUpdateUserProfileMutation,
  useCreateUserMutation,
} from "@/redux/userApi";
import { IUserResponse } from "@/types/user.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";

const userFormSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  password: z.string().optional(),
  profilePicture: z.any().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface IUserFormProps {
  mode: "create" | "edit";
  user?: IUserResponse["data"];
}

export default function UserForm({ mode, user }: IUserFormProps) {
  const router = useRouter();
  const authUser = useSelector((state: RootState) => state.auth.user);

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    user?.profilePicture || null
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [registerUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] =
    useUpdateUserProfileMutation();

  const defaultValues: Partial<UserFormValues> = useMemo(
    () => ({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
      profilePicture: undefined,
    }),
    [user]
  );

  const form = useForm<UserFormValues>({
    resolver: zodResolver(
      mode === "create"
        ? userFormSchema.extend({
            password: z
              .string()
              .min(4, "Password is required and must be at least 4 characters"),
          })
        : userFormSchema
    ),
    defaultValues,
  });

  const handleImageChange = (file: File | undefined) => {
    if (file) {
      if (!file.type.startsWith("image/")) {
        form.setError("profilePicture", {
          type: "manual",
          message: "Please select a valid image file",
        });
        return;
      }

      // Validate file size (e.g., max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        form.setError("profilePicture", {
          type: "manual",
          message: "Image size should be less than 5MB",
        });
        return;
      }

      if (previewUrl && previewUrl !== user?.profilePicture) {
        URL.revokeObjectURL(previewUrl);
      }

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Update form field
      form.setValue("profilePicture", file);
      form.clearErrors("profilePicture");
    }
  };

  const removeImage = () => {
    if (previewUrl && previewUrl !== user?.profilePicture) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    form.setValue("profilePicture", undefined);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== user?.profilePicture) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, user?.profilePicture]);

  const onSubmit = async (values: UserFormValues) => {
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("email", values.email);
      if (values.phone) formData.append("phone", values.phone);
      if (values.address) formData.append("address", values.address);
      if (values.password) formData.append("password", values.password);
      if (values.profilePicture)
        formData.append("profilePicture", values.profilePicture);

      let resultUser: IUserResponse["data"];

      if (mode === "create") {
        const res = await registerUser(formData).unwrap();
        resultUser = res.data;
        toast.success("User created successfully");
      } else {
        const res = await updateUser({
          userId: user!.id,
          data: formData,
        }).unwrap();
        resultUser = res.data;
        toast.success("User updated successfully");
      }

      if (resultUser.role === "CUSTOMER") {
        router.push(`/dashboard/users/${resultUser.id}/user-profile`);
      } else if (
        (resultUser.role === "ADMIN" || resultUser.role === "AGENT") &&
        resultUser.id !== authUser?.id
      ) {
        router.push("/dashboard/users");
      } else {
        router.push(`/dashboard/users/${resultUser.id}/user-profile`);
      }
    } catch (error) {
      console.error("User form submission error:", error);

      // Extract message and field-level errors
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      if (hasFieldErrors && fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof UserFormValues, {
            message: errorMessage,
          });
        });

        toast.error(message);
      } else {
        toast.error(message || "Operation failed");
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

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        {...field}
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
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+233 54 648 8115" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {mode === "create" && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Create a strong password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="profilePicture"
                render={() => (
                  <FormItem>
                    <FormLabel>Profile Picture (Optional)</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {/* Image Preview */}
                        {previewUrl && (
                          <div className="relative w-24 h-24 mx-auto">
                            <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-muted-foreground/20">
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
                            {previewUrl ? "Change Picture" : "Upload Picture"}
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
                  onClick={() => router.push("/dashboard/users")}
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
                  {mode === "create" ? "Create User" : "Update User"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
