// src/app/dashboard/reports/page.tsx
"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Filter, X } from "lucide-react";
import { IReportsQueryParams } from "@/types/reports.types";
import { DashboardOverview } from "@/components/reports/DashboardOverview";
import { MonthlyBookingsReport } from "@/components/reports/MonthlyBookingsReport";
import { PaymentsSummaryReport } from "@/components/reports/PaymentsSummaryReport";
import { TopToursReport } from "@/components/reports/TopToursReport";
import { ReportsFilters } from "@/components/reports/ReportsFilters";

const ReportsPage = () => {
  const searchParams = useSearchParams();
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);

  // Initialize params from URL search params
  const [params, setParams] = React.useState<IReportsQueryParams>(() => {
    const initialParams: IReportsQueryParams = {};

    // Extract params from URL
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const tourId = searchParams.get("tourId");
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const paymentMethod = searchParams.get("paymentMethod");
    const currency = searchParams.get("currency");
    const tourType = searchParams.get("tourType");
    const tourStatus = searchParams.get("tourStatus");
    const limit = searchParams.get("limit");
    const minBookings = searchParams.get("minBookings");

    if (year) initialParams.year = parseInt(year);
    if (month) initialParams.month = parseInt(month);
    if (startDate) initialParams.startDate = startDate;
    if (endDate) initialParams.endDate = endDate;
    if (tourId) initialParams.tourId = parseInt(tourId);
    if (userId) initialParams.userId = parseInt(userId);
    if (status)
      initialParams.status = status as "PENDING" | "CONFIRMED" | "CANCELLED";
    if (paymentMethod)
      initialParams.paymentMethod = paymentMethod as
        | "CREDIT_CARD"
        | "DEBIT_CARD"
        | "MOBILE_MONEY"
        | "BANK_TRANSFER";
    if (currency) initialParams.currency = currency;
    if (tourType)
      initialParams.tourType = tourType as
        | "ADVENTURE"
        | "CULTURAL"
        | "BEACH"
        | "CITY"
        | "WILDLIFE"
        | "CRUISE";
    if (tourStatus)
      initialParams.tourStatus = tourStatus as
        | "UPCOMING"
        | "ONGOING"
        | "COMPLETED"
        | "CANCELLED";
    if (limit) initialParams.limit = parseInt(limit);
    if (minBookings) initialParams.minBookings = parseInt(minBookings);

    return initialParams;
  });

  const [activeTab, setActiveTab] = React.useState("overview");

  const handleFiltersChange = React.useCallback(
    (newFilters: IReportsQueryParams) => {
      setParams(newFilters);

      // Update URL without causing page reload
      const newSearchParams = new URLSearchParams();
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          newSearchParams.set(key, String(value));
        }
      });

      const newUrl = `${
        window.location.pathname
      }?${newSearchParams.toString()}`;
      window.history.replaceState(null, "", newUrl);
    },
    []
  );

  const handleResetFilters = React.useCallback(() => {
    setParams({});
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Prepare params for different components
  const dashboardParams = React.useMemo(() => {
    const { limit, minBookings, ...rest } = params;
    return rest;
  }, [params]);

  const toursParams = React.useMemo(() => {
    return {
      ...params,
      limit: params.limit || 10,
      minBookings: params.minBookings || 1,
    };
  }, [params]);

  // Check if any filters are active
  const hasActiveFilters = React.useMemo(() => {
    return Object.values(params).some(
      (value) => value !== undefined && value !== null && value !== ""
    );
  }, [params]);

  const FiltersComponent = () => (
    <ReportsFilters
      filters={params}
      onFiltersChange={handleFiltersChange}
      onReset={handleResetFilters}
      showTourFilters={activeTab === "tours"}
      showPaymentFilters={activeTab === "payments"}
      showDateFilters={true}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Container with proper spacing */}
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">
              Reports & Analytics
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Comprehensive insights into your tour business performance
            </p>
          </div>

          {/* Mobile Filter Button */}
          <div className="flex items-center gap-2 xl:hidden">
            <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full text-[10px] flex items-center justify-center text-primary-foreground">
                      •
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full sm:w-96 p-0">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold">Filters</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFiltersOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4 overflow-y-auto h-[calc(100vh-80px)]">
                  <FiltersComponent />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Desktop Filters Sidebar */}
          <div className="hidden xl:block xl:w-80 flex-shrink-0">
            <div className="sticky top-6">
              <FiltersComponent />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Tabs */}
            <div className="mb-6">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                {/* Scrollable tabs on mobile */}
                <div className="overflow-x-auto">
                  <TabsList className="grid w-full grid-cols-4 min-w-fit">
                    <TabsTrigger
                      value="overview"
                      className="whitespace-nowrap px-3 sm:px-6"
                    >
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="bookings"
                      className="whitespace-nowrap px-3 sm:px-6"
                    >
                      Bookings
                    </TabsTrigger>
                    <TabsTrigger
                      value="payments"
                      className="whitespace-nowrap px-3 sm:px-6"
                    >
                      Payments
                    </TabsTrigger>
                    <TabsTrigger
                      value="tours"
                      className="whitespace-nowrap px-3 sm:px-6"
                    >
                      Tours
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab Content with proper spacing */}
                <div className="mt-6 min-w-0 overflow-x-hidden">
                  <TabsContent value="overview" className="mt-0 space-y-6">
                    <DashboardOverview params={dashboardParams} />
                  </TabsContent>

                  <TabsContent value="bookings" className="mt-0 space-y-6">
                    <MonthlyBookingsReport params={params} />
                  </TabsContent>

                  <TabsContent value="payments" className="mt-0 space-y-6">
                    <PaymentsSummaryReport params={params} />
                  </TabsContent>

                  <TabsContent value="tours" className="mt-0 space-y-6">
                    <TopToursReport params={toursParams} />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
