// src/components/forms/photo-upload-field.tsx
//
// The reusable "optional photo" form control shared by the tour, room, and
// hotel forms. usePhotoUpload owns the object-URL preview lifecycle (create,
// revoke, cleanup on unmount) and the type/size validation; PhotoUploadField
// renders the preview + upload button; appendPhotoToFormData encodes the
// field onto a multipart submit (a new File, or "" to signal removal).
"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import type {
  Control,
  FieldValues,
  Path,
  PathValue,
  UseFormReturn,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { shouldRemovePhoto } from "@/utils/photo-removal";

/** Object handed back by usePhotoUpload and consumed by PhotoUploadField. */
export interface PhotoUpload {
  previewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageChange: (file: File | undefined) => void;
  removeImage: () => void;
}

/**
 * Manages the preview/upload lifecycle for an optional-image form field:
 * validates type (image/*) and size (<= 5MB), swaps the object-URL preview,
 * and revokes stale URLs (including on unmount). `existingPhoto` is the
 * entity's already-uploaded URL, which is never revoked.
 */
export function usePhotoUpload<T extends FieldValues>({
  form,
  name,
  existingPhoto,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  existingPhoto?: string | null;
}): PhotoUpload {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingPhoto || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (file: File | undefined) => {
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        form.setError(name, {
          type: "manual",
          message: "Please select a valid image file",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        form.setError(name, {
          type: "manual",
          message: "Image size should be less than 5MB",
        });
        return;
      }

      // Clean up old preview URL
      if (previewUrl && previewUrl !== existingPhoto) {
        URL.revokeObjectURL(previewUrl);
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      form.setValue(name, file as unknown as PathValue<T, Path<T>>);
      form.clearErrors(name);
    }
  };

  const removeImage = () => {
    if (previewUrl && previewUrl !== existingPhoto) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    form.setValue(name, undefined as unknown as PathValue<T, Path<T>>);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== existingPhoto) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, existingPhoto]);

  return { previewUrl, fileInputRef, handleImageChange, removeImage };
}

/**
 * Renders the optional-photo field: a centered preview with a remove button
 * when set, plus a dashed upload button. `upload` comes from usePhotoUpload.
 */
export function PhotoUploadField<T extends FieldValues>({
  control,
  name,
  label,
  uploadLabel,
  previewAlt,
  upload,
  disabled,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  /** Button copy when nothing is selected, e.g. "Upload Tour Photo". */
  uploadLabel: string;
  previewAlt: string;
  upload: PhotoUpload;
  disabled?: boolean;
}) {
  const { previewUrl, fileInputRef, handleImageChange, removeImage } = upload;

  return (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="space-y-3">
              {/* Preview */}
              {previewUrl && (
                <div className="relative w-24 h-24 mx-auto">
                  <div className="relative w-full h-full rounded-md overflow-hidden border border-muted-foreground/20">
                    <Image
                      src={previewUrl}
                      alt={previewAlt}
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
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-muted border-dashed border hover:bg-muted/80"
                  disabled={disabled}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {previewUrl ? "Change Photo" : uploadLabel}
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
  );
}

/**
 * Encodes an optional photo field onto a multipart submit: appends the new
 * File when one was chosen, or an empty string (the API's remove signal) when
 * an edit cleared an existing photo. Leaves the field off otherwise.
 */
export function appendPhotoToFormData(
  formData: FormData,
  field: string,
  opts: {
    value: unknown;
    existingPhoto: string | null | undefined;
    isEdit: boolean;
    previewUrl: string | null;
  }
): void {
  if (opts.value) {
    formData.append(field, opts.value as Blob);
  } else if (
    shouldRemovePhoto({
      existingPhoto: opts.existingPhoto,
      isEdit: opts.isEdit,
      newFile: opts.value,
      previewUrl: opts.previewUrl,
    })
  ) {
    // Empty string = the API's remove-photo signal.
    formData.append(field, "");
  }
}
