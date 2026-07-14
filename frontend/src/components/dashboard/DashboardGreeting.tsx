// src/components/dashboard/DashboardGreeting.tsx
"use client";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";

/** Time-aware greeting shown in the dashboard top bar. */
export function DashboardGreeting() {
  const user = useSelector((state: RootState) => state.auth.user);
  if (!user) return null;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.name?.split(" ")[0] ?? "traveller";

  return (
    <p className="min-w-0 truncate font-display text-base font-semibold tracking-tight sm:text-lg">
      {greeting}, {firstName}.
    </p>
  );
}
