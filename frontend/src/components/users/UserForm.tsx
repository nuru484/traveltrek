// src/components/users/UserForm.tsx
//
// STAFF form: /users is staff-only on the backend. Create requires the role
// (ADMIN | AGENT) plus name/email/address (backend adminCreateUserSchema).
// NO password field in either mode: accounts start passwordless and only the
// owner sets/rotates one via Settings → Password (POST /auth/change-password).
// Customers are managed by CustomerForm.
"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { isStaff } from "@/utils/roles";
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
import { FormRootError } from "@/components/ui/form-root-error";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, X, Upload } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  useUpdateUserProfileMutation,
  useCreateUserMutation,
} from "@/redux/userApi";
import { IUserResponse } from "@/types/user.types";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { shouldRemovePhoto } from "@/utils/photo-removal";
import {
  staffCreateFormSchema,
  staffUpdateFormSchema,
  IStaffCreateFormSchema,
} from "@/validation/user-validation";

interface IUserFormProps {
  mode: "create" | "edit";
  user?: IUserResponse["data"];
}

export default function UserForm({ mode, user }: IUserFormProps) {
  const router = useRouter();
  const actor = useSelector((state: RootState) => state.auth.user);
  // Email/phone are login identifiers: a staff member editing their OWN
  // account changes them via Settings -> Contact (the backend 400s the
  // direct write). An admin editing ANOTHER account keeps the fields.
  const isSelf =
    mode === "edit" && isStaff(actor) && actor?.id === user?.id;

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    user?.profilePicture || null
  );
  const [pictureFile, setPictureFile] = useState<File | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] =
    useUpdateUserProfileMutation();

  const defaultValues: Partial<IStaffCreateFormSchema> = useMemo(
    () => ({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
      role: user?.role,
    }),
    [user]
  );

  const form = useForm<IStaffCreateFormSchema>({
    // The edit schema is the create schema minus the role requirement; the
    // cast reconciles the two zod output types for react-hook-form.
    resolver: zodResolver(
      mode === "create" ? staffCreateFormSchema : staffUpdateFormSchema
    ) as Resolver<IStaffCreateFormSchema>,
    defaultValues,
  });

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

    if (previewUrl && previewUrl !== user?.profilePicture) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(URL.createObjectURL(file));
    setPictureFile(file);
  };

  const removeImage = () => {
    if (previewUrl && previewUrl !== user?.profilePicture) {
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
      if (previewUrl && previewUrl !== user?.profilePicture) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, user?.profilePicture]);

  const onSubmit = async (values: IStaffCreateFormSchema) => {
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      // Self-service edits never write the login identifiers - the backend
      // 400s changed values; Settings -> Contact is the verified path.
      if (!isSelf) formData.append("email", values.email);
      if (mode === "create") formData.append("role", values.role);
      if (!isSelf && values.phone) formData.append("phone", values.phone);
      if (values.address) formData.append("address", values.address);
      if (pictureFile) {
        formData.append("profilePicture", pictureFile);
      } else if (
        shouldRemovePhoto({
          existingPhoto: user?.profilePicture,
          isEdit: mode === "edit",
          newFile: pictureFile,
          previewUrl,
        })
      ) {
        // Empty string = the API's remove-photo signal.
        formData.append("profilePicture", "");
      }

      if (mode === "create") {
        await createUser(formData).unwrap();
        toast.success("Staff account created successfully");
      } else {
        await updateUser({
          userId: user!.id,
          data: formData,
        }).unwrap();
        toast.success("Staff account updated successfully");
      }

      router.push("/dashboard/users");
    } catch (error) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);

      const fallback = "Operation failed";

      if (hasFieldErrors && fieldErrors) {
        // Only field names the form actually renders are attached (e.g. the
        // multipart "profilePicture" isn't one); unknown ones fall through
        // to the root error below.
        const unmatched = applyServerFieldErrors(form.setError, fieldErrors, [
          "name",
          "email",
          "phone",
          "address",
          "role",
        ]);
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
                  Your email is how you sign in, and your phone can receive
                  your verification codes — so both change through the
                  verified flow under{" "}
                  <Link
                    href="/dashboard/settings/contact"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Settings &rarr; Contact
                  </Link>
                  , which confirms the new contact before it applies.
                </p>
              )}

              {!isSelf && (
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="staff@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {mode === "create" && (
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a staff role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="AGENT">Agent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {!isSelf && (
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+233 54 648 8115"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {mode === "create" ? "Address" : "Address (Optional)"}
                    </FormLabel>
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

              {mode === "create" && (
                <p className="text-xs text-muted-foreground">
                  Staff accounts start passwordless — the new member sets
                  their own password via the forgot-password email or under
                  Settings once signed in.
                </p>
              )}

              <FormItem>
                <FormLabel>Profile Picture (Optional)</FormLabel>
                <FormControl>
                  <div className="space-y-3">
                    {/* Image Preview */}
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

                    {/* File Input */}
                    <div className="relative">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageChange(e.target.files?.[0])}
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

              {/* Server errors that belong to no single field stay visible
                  here after the toast fades. */}
              <FormRootError />

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
                  {mode === "create" ? "Create Staff" : "Update Staff"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
