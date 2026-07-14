// src/components/reports/ReportsFilters.tsx
"use client";
import * as React from "react";
import {
  Card,
  CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { IReportsQueryParams } from "@/types/reports.types";
import { cn } from "@/lib/utils";

interface ReportsFiltersProps {
  filters: IReportsQueryParams;
  onFiltersChange: (filters: IReportsQueryParams) => void;
  onReset: () => void;
  showTourFilters?: boolean;
  showPaymentFilters?: boolean;
  showDateFilters?: boolean;
}

export const ReportsFilters: React.FC<ReportsFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset,
  showTourFilters = true,
  showPaymentFilters = true,
  showDateFilters = true }) => {
  const [startDate, setStartDate] = React.useState<Date>();
  const [endDate, setEndDate] = React.useState<Date>();

  const handleFilterChange = (key: keyof IReportsQueryParams, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleDateRangeChange = () => {
    if (startDate && endDate) {
      onFiltersChange({
        ...filters,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd") });
    }
  };

  const handleYearMonthChange = (year?: number, month?: number) => {
    onFiltersChange({
      ...filters,
      year,
      month,
      startDate: undefined,
      endDate: undefined });
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  return (
    <Card className="w-full gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between gap-3 bg-night px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground">
        <span>Filters</span>
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground/80 underline-offset-4 hover:text-night-foreground hover:underline"
        >
          Reset
        </button>
      </div>
      <CardContent className="space-y-5 p-4 sm:p-5">
        {/* Date Filters */}
        {showDateFilters && (
          <div className="space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Period
            </p>
            {/* Year and Month - Responsive Grid */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {/* Year */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Year</Label>
                <Select
                  value={filters.year?.toString() ?? "ALL"}
                  onValueChange={(value) =>
                    handleYearMonthChange(
                      value === "ALL" ? undefined : parseInt(value),
                      filters.month
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Years</SelectItem>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Month */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Month</Label>
                <Select
                  value={filters.month?.toString() ?? "ALL"}
                  onValueChange={(value) =>
                    handleYearMonthChange(
                      filters.year,
                      value === "ALL" ? undefined : parseInt(value)
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Months</SelectItem>
                    {months.map((month) => (
                      <SelectItem
                        key={month.value}
                        value={month.value.toString()}
                      >
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Custom Date Range</Label>

              {/* Date Pickers Container */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 min-w-0">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            {startDate
                              ? format(startDate, "MMM d, yyyy")
                              : "Start date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex-1 min-w-0">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            {endDate
                              ? format(endDate, "MMM d, yyyy")
                              : "End date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Button
                  onClick={handleDateRangeChange}
                  disabled={!startDate || !endDate}
                  size="sm"
                  className="w-full cursor-pointer"
                >
                  Apply date range
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Booking Status */}
        <div className="space-y-2 border-t border-dashed border-foreground/15 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            Booking
          </p>
          <Label className="text-sm font-medium">Booking Status</Label>
          <Select
            value={filters.status ?? "ALL"}
            onValueChange={(value) =>
              handleFilterChange("status", value === "ALL" ? undefined : value)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tour Filters */}
        {showTourFilters && (
          <div className="space-y-4 border-t border-dashed border-foreground/15 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Tours
            </p>
            {/* Tour Type and Status - Responsive Grid */}
            <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tour Type</Label>
                <Select
                  value={filters.tourType ?? "ALL"}
                  onValueChange={(value) =>
                    handleFilterChange(
                      "tourType",
                      value === "ALL" ? undefined : value
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select tour type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="ADVENTURE">Adventure</SelectItem>
                    <SelectItem value="CULTURAL">Cultural</SelectItem>
                    <SelectItem value="BEACH">Beach</SelectItem>
                    <SelectItem value="CITY">City</SelectItem>
                    <SelectItem value="WILDLIFE">Wildlife</SelectItem>
                    <SelectItem value="CRUISE">Cruise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tour Status</Label>
                <Select
                  value={filters.tourStatus ?? "ALL"}
                  onValueChange={(value) =>
                    handleFilterChange(
                      "tourStatus",
                      value === "ALL" ? undefined : value
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select tour status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="UPCOMING">Upcoming</SelectItem>
                    <SelectItem value="ONGOING">Ongoing</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Minimum Bookings */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Minimum Bookings</Label>
              <Input
                type="number"
                placeholder="e.g. 5"
                value={filters.minBookings ?? ""}
                onChange={(e) =>
                  handleFilterChange(
                    "minBookings",
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                className="w-full"
                min="0"
              />
            </div>
          </div>
        )}

        {/* Payment Filters */}
        {showPaymentFilters && (
          <div className="space-y-4 border-t border-dashed border-foreground/15 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Payments
            </p>
            {/* Payment Method and Currency - Responsive Grid */}
            <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Method</Label>
                <Select
                  value={filters.paymentMethod ?? "ALL"}
                  onValueChange={(value) =>
                    handleFilterChange(
                      "paymentMethod",
                      value === "ALL" ? undefined : value
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Methods</SelectItem>
                    <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                    <SelectItem value="DEBIT_CARD">Debit Card</SelectItem>
                    <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Currency</Label>
                <Select
                  value={filters.currency ?? "ALL"}
                  onValueChange={(value) =>
                    handleFilterChange(
                      "currency",
                      value === "ALL" ? undefined : value
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Currencies</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GHS">GHS</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Results Limit */}
        <div className="space-y-2 border-t border-dashed border-foreground/15 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            Results
          </p>
          <Label className="text-sm font-medium">Results Limit</Label>
          <Select
            value={filters.limit?.toString() ?? "10"}
            onValueChange={(value) =>
              handleFilterChange("limit", parseInt(value))
            }
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Select limit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
