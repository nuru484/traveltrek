// src/app/dashboard/layout.tsx
import type * as React from "react";
import DashboardSidebar from "@/components/DashboardSidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import ProtectRoutes from "@/components/authentication/ProtectRoutes";
import { UserProfileDropdown } from "@/components/users/UserProfileDropDown";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";

interface AgriLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: AgriLayoutProps) {
  return (
    <ProtectRoutes>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset className="min-w-0">
          <header className="flex h-16 px-4 sm:px-5 z-50 items-center justify-between gap-3 border-b sticky top-0 bg-background">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="flex-none" />
              <DashboardGreeting />
            </div>

            <div className="flex flex-none gap-2">
              <UserProfileDropdown />
            </div>
          </header>
          <main className="@container/main min-w-0 flex-1 p-3 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectRoutes>
  );
}
