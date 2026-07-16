// src/components/flights/flight-schedule-card.tsx
//
// "Flight Schedule" card: status (with the admin status-transition dropdown),
// departure, arrival and duration tiles.
"use client";
import { ChevronDown, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { IFlight } from "@/types/flight.types";
import {
  formatFlightDateTime,
  formatFlightDuration,
  getAvailableStatusTransitions,
  getFlightStatusConfig } from "./flight-detail-logic";

interface IFlightScheduleCardProps {
  flight: IFlight;
  canUpdateStatus: boolean;
  isLoading: boolean;
  onStatusChange: (status: string) => void;
}

export function FlightScheduleCard({
  flight,
  canUpdateStatus,
  isLoading,
  onStatusChange }: IFlightScheduleCardProps) {
  const flightStatusConfig = getFlightStatusConfig(flight.status);
  const StatusIcon = flightStatusConfig.icon;
  const availableStatusTransitions = getAvailableStatusTransitions(
    flight.status
  );

  return (
    <Card className="py-0">
      <CardContent className="p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Plane className="h-5 w-5" />
          Flight Schedule
        </h3>
        <div className="grid grid-cols-1 items-start gap-4 @2xl/main:grid-cols-4">
          {/* Flight Status with Dropdown for Admin/Agent */}
          <div className="bg-muted/30 rounded-lg p-4">
            <p className="font-medium text-foreground mb-2">Flight Status</p>
            {canUpdateStatus && availableStatusTransitions.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer w-full justify-between"
                    disabled={isLoading}
                  >
                    <div className="flex items-center">
                      <StatusIcon className="h-4 w-4 mr-2" />
                      {flightStatusConfig.label}
                    </div>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <div className="px-2 py-1.5 text-sm font-semibold">
                    Update Status
                  </div>
                  <DropdownMenuSeparator />
                  {availableStatusTransitions.map((status) => {
                    const statusConfig = getFlightStatusConfig(status);
                    const StatusIcon = statusConfig.icon;
                    return (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => onStatusChange(status)}
                        disabled={isLoading}
                        className="cursor-pointer"
                      >
                        <StatusIcon className="mr-2 h-4 w-4" />
                        {statusConfig.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge variant={flightStatusConfig.variant} className="text-sm">
                <StatusIcon className="h-4 w-4 mr-2" />
                {flightStatusConfig.label}
              </Badge>
            )}
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="font-medium text-foreground mb-1">Departure</p>
            <p className="text-sm text-muted-foreground">
              {formatFlightDateTime(flight.departure)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="font-medium text-foreground mb-1">Arrival</p>
            <p className="text-sm text-muted-foreground">
              {formatFlightDateTime(flight.arrival)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="font-medium text-foreground mb-1">Duration</p>
            <p className="text-sm text-muted-foreground">
              {formatFlightDuration(flight.duration)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
