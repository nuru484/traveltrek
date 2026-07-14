// src/app/dashboard/reports/page.tsx
"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  BookOpen,
  CreditCard,
  Filter,
  LayoutDashboard,
  MapPin,
} from "lucide-react";
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

  const filtersNode = (
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
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      {/* Container with proper spacing */}
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="min-w-0 truncate text-2xl font-bold sm:text-3xl">
              Reports & Analytics
            </h1>

            {/* Filters trigger sits on the title row */}
            <div className="flex-none xl:hidden">
              <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="relative">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full text-[10px] flex items-center justify-center text-primary-foreground">
                        •
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full gap-0 p-0 sm:w-96">
                  <SheetHeader className="border-b px-4 py-3">
                    <SheetTitle className="text-lg">Filters</SheetTitle>
                  </SheetHeader>
                  <div className="h-full overflow-y-auto p-4 pb-24">
                    {filtersNode}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Comprehensive insights into your tour business performance
          </p>
        </div>

        {/* Main Layout */}
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Desktop Filters Sidebar */}
          <div className="hidden xl:block xl:w-80 flex-shrink-0">
            <div className="sticky top-6">
              {filtersNode}
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
                <div className="hidden md:block">
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

      {/* Phone tab bar — mirrors the landing page's bottom navigation */}
      <nav
        aria-label="Report sections"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
      >
        <div className="grid grid-cols-4">
          {[
            { value: "overview", label: "Overview", icon: LayoutDashboard },
            { value: "bookings", label: "Bookings", icon: BookOpen },
            { value: "payments", label: "Payments", icon: CreditCard },
            { value: "tours", label: "Tours", icon: MapPin },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              aria-pressed={activeTab === value}
              className={`flex cursor-pointer flex-col items-center gap-1 py-2.5 transition-colors active:bg-muted/40 ${
                activeTab === value
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              <span className="font-mono text-[9px] uppercase tracking-[0.14em]">
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default ReportsPage;
