import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Phone, MapPin, Calendar } from "lucide-react";

export function UserProfileHeaderSkeleton() {
  return (
    <div className="container mx-auto bg-card rounded-2xl p-4 lg:p-8 border border-border transition- duration-200">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Avatar Skeleton */}
        <div className="flex-shrink-0 mx-auto lg:mx-0">
          <div className="relative">
            <div className="h-36 w-36 rounded-full ring-4 ring-background">
              <Skeleton className="h-full w-full rounded-full" />
            </div>
            {/* Online status indicator */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-muted rounded-full border-[3px] border-background">
              <Skeleton className="h-full w-full rounded-full" />
            </div>
          </div>
        </div>

        {/* User Info Skeleton */}
        <div className="flex-1 min-w-0">
          <div className="text-center lg:text-left">
            {/* Name and Role Badge Skeleton */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:gap-4 mb-3">
              <Skeleton className="h-8 w-48 mx-auto lg:mx-0 mb-2 lg:mb-0" />
              <div className="w-fit mx-auto lg:mx-0">
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>

            {/* Contact Information Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Email Skeleton */}
              <div className="flex items-center gap-3 text-foreground bg-muted rounded-lg p-3">
                <div className="flex-shrink-0 w-8 h-8 bg-chart-2/20 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-chart-2" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>

              {/* Phone Skeleton */}
              <div className="flex items-center gap-3 text-foreground bg-muted rounded-lg p-3">
                <div className="flex-shrink-0 w-8 h-8 bg-chart-4/20 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-chart-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>

              {/* Address Skeleton */}
              <div className="flex items-center gap-3 text-foreground bg-muted rounded-lg p-3">
                <div className="flex-shrink-0 w-8 h-8 bg-chart-5/20 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-chart-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>

              {/* Joined Date Skeleton */}
              <div className="flex items-center gap-3 text-foreground bg-muted rounded-lg p-3">
                <div className="flex-shrink-0 w-8 h-8 bg-chart-3/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-chart-3" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>

            {/* Status Badges Skeleton */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-4">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>

            {/* Last Updated Skeleton */}
            <div className="border-t border-border pt-4">
              <Skeleton className="h-3 w-36 mx-auto lg:mx-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfileHeaderSkeleton;
