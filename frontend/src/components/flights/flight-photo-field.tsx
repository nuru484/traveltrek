// src/components/flights/flight-photo-field.tsx
//
// Photo preview + upload/remove controls for the flight form. Selection and
// removal logic (validation, object URLs, form state) stay with the parent.
"use client";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface IFlightPhotoFieldProps {
  previewUrl: string | null;
  isLoading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImageChange: (file: File | undefined) => void;
  onRemove: () => void;
}

export function FlightPhotoField({
  previewUrl,
  isLoading,
  fileInputRef,
  onImageChange,
  onRemove }: IFlightPhotoFieldProps) {
  return (
    <div className="space-y-3">
      {/* Preview */}
      {previewUrl && (
        <div className="relative w-24 h-24 mx-auto">
          <div className="relative w-full h-full rounded-md overflow-hidden border border-muted-foreground/20">
            <Image
              src={previewUrl}
              alt="Flight photo preview"
              fill
              className="object-cover"
            />
          </div>
          <button
            type="button"
            onClick={onRemove}
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
          onChange={(e) => onImageChange(e.target.files?.[0])}
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
          {previewUrl ? "Change Photo" : "Upload Flight Photo"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Supported formats: JPG, PNG, GIF (Max 5MB)
      </p>
    </div>
  );
}
