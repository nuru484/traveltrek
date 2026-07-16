"use client";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { useEffect, useSyncExternalStore } from "react";
import { RootState } from "@/redux/store";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "../ui/card";

// Sidebar Skeleton Component - Hidden on mobile
function SidebarSkeleton() {
  return (
    <div className="hidden lg:block w-52 xl:w-64 bg-background border-r">
      <div className="p-4 xl:p-6">
        {/* Logo/Brand area */}
        <Skeleton className="h-8 w-28 xl:w-32 mb-6 xl:mb-8" />

        {/* Navigation items */}
        <div className="space-y-3 xl:space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-2 xl:space-x-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-20 xl:w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* User section */}
      <div className="absolute bottom-4 xl:bottom-6 left-4 xl:left-6 right-4 xl:right-6">
        <div className="flex items-center space-x-2 xl:space-x-3 p-2 xl:p-3 rounded-lg bg-foreground/5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-16 xl:w-20" />
            <Skeleton className="h-2 w-12 xl:w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Header Skeleton Component
function HeaderSkeleton() {
  return (
    <header className="bg-background border-b px-3 sm:px-4 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between">
        {/* Mobile menu icon + title */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Skeleton className="h-6 w-6 lg:hidden" /> {/* Hamburger menu */}
          <Skeleton className="h-5 sm:h-6 w-32 sm:w-40 md:w-48" />
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
          <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 rounded-full" />
          <Skeleton className="hidden sm:block h-8 w-20 md:w-24 rounded-md" />
        </div>
      </div>
    </header>
  );
}

// Card Skeleton Component
function CardSkeleton({
  variant = "default",
}: {
  variant?: "default" | "stat" | "chart";
}) {
  if (variant === "stat") {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
            <Skeleton className="h-3 sm:h-4 w-3 sm:w-4" />
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
          <Skeleton className="h-6 sm:h-7 md:h-8 w-12 sm:w-14 md:w-16 mb-1 sm:mb-2" />
          <Skeleton className="h-2 sm:h-3 w-20 sm:w-24" />
        </CardContent>
      </Card>
    );
  }

  if (variant === "chart") {
    return (
      <Card className="h-full">
        <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <Skeleton className="h-5 sm:h-6 w-28 sm:w-32" />
            <Skeleton className="h-7 sm:h-8 w-20 sm:w-24 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
          <Skeleton className="h-40 sm:h-48 md:h-56 lg:h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
        <Skeleton className="h-5 sm:h-6 w-28 sm:w-32 md:w-36" />
      </CardHeader>
      <CardContent className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
        <div className="space-y-3 sm:space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 p-2 sm:p-3 rounded-lg bg-foreground/5"
            >
              <Skeleton className="h-6 w-6 sm:h-8 sm:w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1 sm:space-y-2 min-w-0">
                <Skeleton className="h-3 sm:h-4 w-24 sm:w-28 md:w-32" />
                <Skeleton className="h-2 sm:h-3 w-16 sm:w-20 md:w-24" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Dashboard Skeleton Component
export function DashboardSkeleton() {
  return (
    <div className="flex h-screen bg-primary/5 overflow-hidden">
      <SidebarSkeleton />

      <div className="flex-1 flex flex-col min-w-0">
        <HeaderSkeleton />

        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
          {/* Page Title */}
          <div className="mb-4 sm:mb-6">
            <Skeleton className="h-6 sm:h-7 md:h-8 w-48 sm:w-56 md:w-64 mb-1 sm:mb-2" />
            <Skeleton className="h-3 sm:h-4 w-64 sm:w-80 md:w-96" />
          </div>

          {/* Stats Cards - Responsive Grid */}
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} variant="stat" />
            ))}
          </div>

          {/* Main Content - Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
            {/* Chart Card - Full width on mobile, spans 2 cols on large screens */}
            <div className="lg:col-span-2">
              <CardSkeleton variant="chart" />
            </div>

            {/* Two cards side by side on large screens, stacked on mobile */}
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </main>
      </div>
    </div>
  );
}

interface ProtectedProps {
  children: React.ReactNode;
}

/** Stable no-op subscription for the mounted useSyncExternalStore below. */
const emptySubscribe = () => () => {};

export default function ProtectRoutes({ children }: ProtectedProps) {
  const user = useSelector((state: RootState) => state.auth.user);
  const router = useRouter();

  // authSlice seeds `user` from localStorage, which the server can't see —
  // SSR always renders the skeleton. useSyncExternalStore's server snapshot
  // keeps the hydration render on the skeleton too (no mismatch); the first
  // client-side re-render then swaps in the real layout.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (mounted && !user) {
      router.push("/");
    }
  }, [mounted, user, router]);

  if (!mounted || !user) {
    return <DashboardSkeleton />;
  }

  return <>{children}</>;
}
