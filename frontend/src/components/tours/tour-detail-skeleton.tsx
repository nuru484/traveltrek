// src/components/tours/tour-detail-skeleton.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TourDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Card Skeleton */}
      <Card className="overflow-hidden">
        <CardContent className="p-6 relative">
          {/* Actions Skeleton */}
          <div className="absolute top-3 right-3">
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>

          {/* Tour Info Skeleton */}
          <div className="space-y-4">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Skeleton className="h-8 sm:h-10 md:h-12 lg:h-14 w-3/4" />
              <Skeleton className="h-8 sm:h-10 md:h-12 lg:h-14 w-1/2 sm:hidden" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Section Skeleton */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Location Card */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Card */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-3">
                <Skeleton className="h-5 w-20" />

                <div className="space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>

                <div className="space-y-1">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Details Card */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4">
              {/* Price */}
              <div className="space-y-1">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-8 w-24" />
              </div>

              {/* Duration and Max Guests */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-14" />
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-18" />
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
