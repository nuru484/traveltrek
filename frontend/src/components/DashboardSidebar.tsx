"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import Image from "next/image";
import {
  MapPin,
  Plane,
  Hotel,
  Users,
  BookOpen,
  CreditCard,
  LayoutDashboard,
  Home,
  BarChart3,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "./ui/sidebar";

// Navigation items for admins and customers
const adminNavigationItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Users",
    path: "/dashboard/users",
    icon: Users,
  },
  {
    name: "Tours",
    path: "/dashboard/tours",
    icon: MapPin,
  },
  {
    name: "Flights",
    path: "/dashboard/flights",
    icon: Plane,
  },
  {
    name: "Hotels",
    path: "/dashboard/hotels",
    icon: Hotel,
  },
  {
    name: "Destinations",
    path: "/dashboard/destinations",
    icon: Home,
  },
  {
    name: "Bookings",
    path: "/dashboard/bookings",
    icon: BookOpen,
  },
  {
    name: "Payments",
    path: "/dashboard/payments",
    icon: CreditCard,
  },
  {
    name: "Reports",
    path: "/dashboard/reports",
    icon: BarChart3,
  },
];

const customerNavigationItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Browse Tours",
    path: "/dashboard/tours",
    icon: MapPin,
  },
  {
    name: "Browse Hotels",
    path: "/dashboard/hotels",
    icon: Hotel,
  },
  {
    name: "Browse Flights",
    path: "/dashboard/flights",
    icon: Plane,
  },
  {
    name: "My Bookings",
    path: "/dashboard/bookings",
    icon: BookOpen,
  },
  {
    name: "My Payments",
    path: "/dashboard/payments",
    icon: CreditCard,
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN" || user?.role === "AGENT";

  const { isMobile, setOpenMobile } = useSidebar();

  const navigationItems = isAdmin
    ? adminNavigationItems
    : customerNavigationItems;

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/20 shadow-sm"
    >
      <SidebarHeader className="flex items-center py-5 border-b border-sidebar-border/20">
        <SidebarMenuButton className="flex h-10 cursor-pointer items-center gap-3 text-sidebar-foreground">
          <Image
            src="/logo.png"
            alt="Travel Trek Logo"
            width={50}
            height={50}
          />
          <span className="text-xl font-bold">TravelTrek</span>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu className="space-y-1.5">
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.path ||
              (item.path !== "/dashboard" && pathname?.startsWith(item.path));
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.name}
                  className={`px-4 py-3 gap-4 hover:bg-sidebar-foreground/10 transition-colors ${
                    isActive
                      ? "bg-sidebar-primary/10 text-sidebar-primary font-medium border-l-4 border-sidebar-primary"
                      : "text-sidebar-foreground/90"
                  }`}
                >
                  <Link
                    href={item.path}
                    className="flex items-center w-full"
                    onClick={handleLinkClick} // Add this handler
                  >
                    <item.icon
                      className={`h-6 w-6 ${
                        isActive ? "text-sidebar-primary" : ""
                      }`}
                    />
                    <span className="ml-3">{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-sidebar-border/20">
        <SidebarMenuButton className="flex items-center gap-3 text-sidebar-foreground">
          <Image
            src="/logo.png"
            alt="Travel Trek Logo"
            width={30}
            height={30}
          />
          <div className="text-[12px] text-sidebar-foreground/70">
            TravelTrek Tour System
          </div>
        </SidebarMenuButton>
      </SidebarFooter>

      <SidebarRail className="bg-sidebar-foreground/5 w-1" />
    </Sidebar>
  );
}
