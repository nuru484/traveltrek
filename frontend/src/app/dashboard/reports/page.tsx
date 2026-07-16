// src/app/dashboard/reports/page.tsx
//
// Reports & analytics: four tabs (Overview / Bookings / Payments / Tours),
// each owning its own collapsed filter bar and per-card query states. The
// old always-visible 320px filter sidebar is gone — filters live in each
// tab's ReportFilterBar (inline panel on lg+, bottom sheet below).
"use client";
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  CreditCard,
  LayoutDashboard,
  MapPin,
} from "lucide-react";
import { OverviewSection } from "@/components/reports/OverviewSection";
import { BookingsSection } from "@/components/reports/BookingsSection";
import { PaymentsSection } from "@/components/reports/PaymentsSection";
import { ToursSection } from "@/components/reports/ToursSection";

const ReportsPage = () => {
  const [activeTab, setActiveTab] = React.useState("overview");

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="min-w-0 truncate text-2xl font-bold sm:text-3xl">
            Reports & Analytics
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Comprehensive insights into your tour business performance
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Desktop tab list; phones use the bottom bar below */}
          <div className="hidden md:block">
            <TabsList className="grid w-full grid-cols-4 min-w-fit">
              <TabsTrigger value="overview" className="whitespace-nowrap px-3 sm:px-6">
                Overview
              </TabsTrigger>
              <TabsTrigger value="bookings" className="whitespace-nowrap px-3 sm:px-6">
                Bookings
              </TabsTrigger>
              <TabsTrigger value="payments" className="whitespace-nowrap px-3 sm:px-6">
                Payments
              </TabsTrigger>
              <TabsTrigger value="tours" className="whitespace-nowrap px-3 sm:px-6">
                Tours
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-6 min-w-0 overflow-x-hidden">
            <TabsContent value="overview" className="mt-0">
              <OverviewSection />
            </TabsContent>

            <TabsContent value="bookings" className="mt-0">
              <BookingsSection />
            </TabsContent>

            <TabsContent value="payments" className="mt-0">
              <PaymentsSection />
            </TabsContent>

            <TabsContent value="tours" className="mt-0">
              <ToursSection />
            </TabsContent>
          </div>
        </Tabs>
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
