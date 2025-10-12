// src/components/reports/TopToursReport.tsx
"use client";
import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  MapPin,
  Star,
  Users,
  Calendar,
  DollarSign,
} from "lucide-react";
import { useGetTopToursByBookingsQuery } from "@/redux/reportsApi";
import { IReportsQueryParams, ITourTopStats } from "@/types/reports.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { formatCurrency } from "@/utils/formatCurrency";
import { format } from "date-fns";

interface TopToursReportProps {
  params: IReportsQueryParams;
}

export const TopToursReport: React.FC<TopToursReportProps> = ({ params }) => {
  const { data, error, isError, isLoading, refetch } =
    useGetTopToursByBookingsQuery(params);

  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  if (isError) {
    const errorMessage = extractApiErrorMessage(error).message;
    return <ErrorMessage error={errorMessage} onRetry={handleRefresh} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { summary, topTours } = data.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Top Tours Report</h2>
          <p className="text-muted-foreground">
            Top performing tours by bookings
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
          <CardDescription>Overview of analyzed data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {summary.totalToursAnalyzed}
              </div>
              <p className="text-sm text-muted-foreground">Tours Analyzed</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {summary.totalBookingsAnalyzed}
              </div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalRevenueAnalyzed)}
              </div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </div>

          {/* Filters Applied */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-2">Applied Filters:</h4>
            <div className="flex flex-wrap gap-2">
              {summary.filters.tourType && (
                <Badge variant="outline">{summary.filters.tourType}</Badge>
              )}
              {summary.filters.tourStatus && (
                <Badge variant="outline">{summary.filters.tourStatus}</Badge>
              )}
              <Badge variant="outline">
                Min Bookings: {summary.filters.minBookings}
              </Badge>
              <Badge variant="outline">Limit: {summary.filters.limit}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Tours */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Top Performing Tours</h3>
        {topTours.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                No tours found matching the criteria
              </p>
            </CardContent>
          </Card>
        ) : (
          topTours.map((tourStats, index) => (
            <TourStatsCard
              key={tourStats.tour.id}
              tourStats={tourStats}
              rank={index + 1}
            />
          ))
        )}
      </div>
    </div>
  );
};

const TourStatsCard: React.FC<{ tourStats: ITourTopStats; rank: number }> = ({
  tourStats,
  rank,
}) => {
  const { tour, statistics } = tourStats;

  const getTourTypeColor = (type: string) => {
    const colors = {
      ADVENTURE: "bg-red-100 text-red-800",
      CULTURAL: "bg-purple-100 text-purple-800",
      BEACH: "bg-blue-100 text-blue-800",
      CITY: "bg-green-100 text-green-800",
      WILDLIFE: "bg-yellow-100 text-yellow-800",
      CRUISE: "bg-indigo-100 text-indigo-800",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getStatusColor = (status: string) => {
    const colors = {
      UPCOMING: "bg-blue-100 text-blue-800",
      ONGOING: "bg-green-100 text-green-800",
      COMPLETED: "bg-gray-100 text-gray-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  // Format destination location
  const getLocationString = () => {
    const { destination } = tour;
    if (destination.city) {
      return `${destination.city}, ${destination.country}`;
    }
    return destination.country;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
              #{rank}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{tour.name}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={getTourTypeColor(tour.type)}>
                  {tour.type}
                </Badge>
                <Badge className={getStatusColor(tour.status)}>
                  {tour.status}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(tour.price)}
            </p>
            <p className="text-sm text-muted-foreground">
              {tour.duration} days
            </p>
          </div>
        </div>

        {tour.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {tour.description}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{statistics.totalBookings}</p>
              <p className="text-xs text-muted-foreground">Total Bookings</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm font-medium">
                {statistics.confirmedBookings}
              </p>
              <p className="text-xs text-muted-foreground">Confirmed</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {formatCurrency(statistics.totalRevenue)}
              </p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">
                {statistics.averageRating > 0
                  ? statistics.averageRating.toFixed(1)
                  : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                {statistics.reviewCount} review
                {statistics.reviewCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{getLocationString()}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {format(new Date(tour.startDate), "MMM dd")} -{" "}
              {format(new Date(tour.endDate), "MMM dd, yyyy")}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Max: {tour.maxGuests} guests
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
