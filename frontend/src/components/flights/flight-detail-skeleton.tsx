// src/components/flights/flight-detail-skeleton.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function FlightDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Section Skeleton */}
      <Card className="overflow-hidden">
        <div className="relative w-full h-48 sm:h-56 md:h-64 lg:h-80 xl:h-96">
          <Skeleton className="absolute inset-0" />

          {/* Actions Skeleton */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex gap-2">
            <Skeleton className="h-8 w-16 sm:w-20 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>

          {/* Hero Content Skeleton */}
          <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-6 sm:h-8 md:h-9 lg:h-10 w-40 sm:w-56 md:w-72" />
              <Skeleton className="h-4 sm:h-5 lg:h-6 w-28 sm:w-36" />
            </div>
          </div>
        </div>
      </Card>

      {/* Flight Details Skeleton - Horizontal Layout */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Origin Card Skeleton */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Destination Card Skeleton */}
        <Card className="border-l-4 border-l-secondary">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Card Skeleton */}
        <Card className="border-l-4 border-l-accent">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-3">
                <Skeleton className="h-4 w-16" />
                <div>
                  <Skeleton className="h-3 w-16 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div>
                  <Skeleton className="h-3 w-12 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Details Card Skeleton */}
        <Card className="border-l-4 border-l-muted">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expanded Schedule & Availability Section Skeleton */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Detailed Schedule Skeleton */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <Skeleton className="h-4 w-12 mb-2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Availability Skeleton */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-3 w-10 mb-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div>
                  <Skeleton className="h-3 w-12 mb-1" />
                  <Skeleton className="h-4 w-14" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
