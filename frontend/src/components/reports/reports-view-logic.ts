// src/components/reports/reports-view-logic.ts
//
// Pure role → reports-surface mapping for /dashboard/reports, mirroring the
// backend gates (routes/reports.ts): the four admin dashboards are
// ADMIN-only, /reports/agent-activity is staff, /reports/me is CUSTOMER.
import type { UserRole } from "@/types/user.types";

export type ReportsView = "admin-tabs" | "agent-activity" | "customer-summary";

export function reportsViewForRole(role: UserRole): ReportsView {
  switch (role) {
    case "ADMIN":
      return "admin-tabs";
    case "AGENT":
      return "agent-activity";
    default:
      return "customer-summary";
  }
}

/** Page heading + sub-copy per reports surface. */
export const REPORTS_VIEW_COPY: Record<
  ReportsView,
  { title: string; description: string }
> = {
  "admin-tabs": {
    title: "Reports & Analytics",
    description: "Comprehensive insights into your tour business performance",
  },
  "agent-activity": {
    title: "My Activity",
    description: "Bookings you recorded for customers and what they produced",
  },
  "customer-summary": {
    title: "My Travel Summary",
    description: "Your trips, spending and bookings at a glance",
  },
};
