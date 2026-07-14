// src/components/rooms/room-form-skeleton.tsx
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-muted rounded ${className}`} />
);

export function RoomFormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4 sm:pb-6">
        <div className="mx-auto w-full max-w-7xl space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-7 w-48" />
            <div className="mt-1">
              <Skeleton className="h-4 w-72" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Hotel Selection */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Room Type */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Price and Capacity Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>

            {/* Amenities */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Available Checkbox */}
            <div className="flex flex-row items-start space-x-3 space-y-0">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <div className="space-y-1 leading-none">
                <Skeleton className="h-4 w-36" />
              </div>
            </div>

            {/* Room Photo */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <div className="mt-2">
                  <Skeleton className="h-24 w-24 rounded-md" />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" disabled className="flex-1">
                Cancel
              </Button>
              <Button disabled className="flex-1">
                <div className="mr-2 h-4 w-4" />
                Loading...
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
