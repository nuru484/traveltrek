// src/components/users/UserFormSkeleton.tsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for the staff edit-profile page, mirroring the real
 * layout: the DetailPageHeader block, then UserForm's narrow centered card
 * of single-column fields, the avatar upload block, and the paired
 * Cancel/Update buttons.
 */
export default function UserFormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      {/* DetailPageHeader: back link, title, description */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xs" />
      </div>

      <div className="space-y-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent>
            <div className="space-y-6">
              {/* Single-column fields: name, email/contact note, phone, address */}
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}

              {/* Profile picture: centered avatar, upload button, caption */}
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mx-auto h-24 w-24 rounded-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="mx-auto h-3 w-56" />
              </div>

              {/* Cancel / Update buttons */}
              <div className="flex gap-3 pt-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
