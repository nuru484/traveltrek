// src/components/reports/TopToursReport.tsx
"use client";
import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  MapPin,
  Calendar } from "lucide-react";
import { useGetTopToursByBookingsQuery } from "@/redux/reportsApi";
import { IReportsQueryParams, ITourTopStats } from "@/types/reports.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { format } from "date-fns";
import { Money } from "@/components/ui/Money";

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
              <div className="h-20 bg-muted rounded"></div>
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
                <Money amount={summary.totalRevenueAnalyzed} symbol="$" />
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
  rank }) => {
  const { tour, statistics } = tourStats;

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
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Nº{rank}
            </p>
            <h3 className="mt-1 text-lg font-semibold leading-snug">
              {tour.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{tour.type}</Badge>
              <Badge variant="outline">{tour.status}</Badge>
            </div>
          </div>
          <div className="flex-none text-right">
            <p className="text-xl font-semibold text-foreground">
              <Money amount={tour.price} symbol="$" />
            </p>
            <p className="text-xs text-muted-foreground">
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
          <div className="min-w-0">
            <p className="text-sm font-medium">{statistics.totalBookings}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Total Bookings</p>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium">
                {statistics.confirmedBookings}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Confirmed</p>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium">
                <Money amount={statistics.totalRevenue} symbol="$" />
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Revenue</p>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium">
              {statistics.averageRating > 0
                ? statistics.averageRating.toFixed(1)
                : "N/A"}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {statistics.reviewCount} review
              {statistics.reviewCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-4 border-t">
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <MapPin className="h-4 w-4 flex-none text-muted-foreground" />
            <span className="min-w-0 truncate text-sm">{getLocationString()}</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Calendar className="h-4 w-4 flex-none text-muted-foreground" />
            <span className="text-sm">
              {format(new Date(tour.startDate), "MMM dd")} -{" "}
              {format(new Date(tour.endDate), "MMM dd, yyyy")}
            </span>
          </div>
          <div className="whitespace-nowrap text-sm text-muted-foreground">
            Max: {tour.maxGuests.toLocaleString()} guests
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
