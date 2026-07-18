// src/components/hotels/hotel-detail-skeleton.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function HotelDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Section Skeleton */}
      <Card className="overflow-hidden">
        <div className="relative w-full h-48 sm:h-56 md:h-64 lg:h-80 xl:h-96">
          <Skeleton className="absolute inset-0" />
          
          {/* Admin Actions Skeleton */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>

          {/* Hero Content Skeleton */}
          <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-6 sm:h-8 md:h-9 lg:h-10 w-48 sm:w-64 md:w-80" />
              <Skeleton className="h-4 sm:h-5 lg:h-6 w-32 sm:w-40" />
            </div>
          </div>
        </div>
      </Card>

      {/* Hotel Details Skeleton - Horizontal Layout */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Location Card Skeleton */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Destination Card Skeleton */}
        <Card>
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

        {/* Star Rating & Contact Card Skeleton */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description & Amenities Card Skeleton */}
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-4">
                {/* Description Section */}
                <div>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                
                {/* Amenities Section */}
                <div>
                  <Skeleton className="h-4 w-16 mb-2" />
                  <div className="flex flex-wrap gap-1">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Rooms Section Skeleton */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 sm:h-6 w-36 sm:w-48" />
            </div>
            <Skeleton className="h-8 w-16 sm:w-20" />
          </div>

          {/* Rooms Grid Skeleton */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                    <Skeleton className="h-4 w-4 ml-2 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}