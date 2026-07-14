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

interface AgriLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: AgriLayoutProps) {
  return (
    <ProtectRoutes>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset>
          <header className="flex h-16 px-5 z-50 items-center justify-between border-b sticky top-0 bg-background">
            <SidebarTrigger className="mr-2" />

            <div className="flex gap-2">
              <UserProfileDropdown />
            </div>
          </header>
          <main className="flex-1 p-3 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectRoutes>
  );
}
