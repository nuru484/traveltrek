// src/components/dashboard/needs-attention.tsx
//
// The staff dashboard's operational strip: live counts of work needing
// action, each tile linking to the page where it gets done. Windows and
// thresholds in the descriptions mirror the backend
// (services/dashboard.service.ts) so each link shows what was counted.
"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Inbox,
  LucideIcon,
  Plane,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { INeedsAttentionCounts } from "@/types/dashboard.types";

interface AttentionItem {
  key: string;
  label: string;
  description: string;
  count: number;
  href: string;
  icon: LucideIcon;
  activeIconClassName: string;
}

export function NeedsAttention({ data }: { data: INeedsAttentionCounts }) {
  const items: AttentionItem[] = [
    {
      key: "pending-bookings",
      label: "Pending bookings",
      description: "Bookings awaiting confirmation",
      count: data.pendingBookings,
      href: "/dashboard/bookings?status=PENDING",
      icon: Inbox,
      activeIconClassName:
        "bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    },
    {
      key: "pending-payments",
      label: "Pending payments",
      description: "Payments not yet completed",
      count: data.pendingPayments,
      href: "/dashboard/payments?status=PENDING",
      icon: CreditCard,
      activeIconClassName:
        "bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    },
    {
      key: "failed-payments",
      label: "Failed payments",
      description: "Payments that need follow-up",
      count: data.failedPayments,
      href: "/dashboard/payments?status=FAILED",
      icon: AlertTriangle,
      activeIconClassName:
        "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    },
    {
      key: "low-occupancy-tours",
      label: "Low-occupancy tours",
      description: "Starting within 14 days, under 30% booked",
      count: data.upcomingToursLowOccupancy,
      href: "/dashboard/tours",
      icon: Users,
      activeIconClassName:
        "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    },
    {
      key: "empty-flights",
      label: "Undersold flights",
      description: "Departing within 7 days, over 70% seats unsold",
      count: data.flightsDepartingSoonLowSeats,
      href: "/dashboard/flights",
      icon: Plane,
      activeIconClassName:
        "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    },
  ];

  const totalCount = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-2 p-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Needs attention
          </h2>
          <p className="text-sm text-muted-foreground">
            Live operational view of work waiting on you.
          </p>
        </div>

        {totalCount === 0 ? (
          <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            All caught up
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {totalCount} item{totalCount === 1 ? "" : "s"} to review
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 pt-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => {
          const isActive = item.count > 0;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "group rounded-lg border border-border p-4 transition-colors",
                isActive
                  ? "hover:border-primary/40"
                  : "bg-muted/30 hover:bg-muted/50",
              )}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      isActive
                        ? item.activeIconClassName
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  </div>
                  <span
                    className={cn(
                      "font-display text-2xl font-semibold",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.count}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Review <ArrowRight className="h-3 w-3 shrink-0" aria-hidden />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
