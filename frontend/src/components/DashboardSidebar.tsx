"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { isAdmin, isAgent } from "@/utils/roles";
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
  ShieldCheck,
  Star,
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

// Navigation items for admins
const adminNavigationItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Customers",
    path: "/dashboard/customers",
    icon: Users,
  },
  {
    name: "Staff",
    path: "/dashboard/users",
    icon: ShieldCheck,
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
    name: "Reviews",
    path: "/dashboard/reviews",
    icon: Star,
  },
  {
    name: "Reports",
    path: "/dashboard/reports",
    icon: BarChart3,
  },
];

// Navigation items for agents
const agentNavigationItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Customers",
    path: "/dashboard/customers",
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
    name: "Bookings",
    path: "/dashboard/bookings",
    icon: BookOpen,
  },
  {
    name: "My Payments",
    path: "/dashboard/payments",
    icon: CreditCard,
  },
  {
    name: "Reviews",
    path: "/dashboard/reviews",
    icon: Star,
  },
  {
    name: "My Activity",
    path: "/dashboard/reports",
    icon: BarChart3,
  },
];

// Navigation items for customers
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
  {
    name: "My Reviews",
    path: "/dashboard/reviews",
    icon: Star,
  },
  {
    name: "My Reports",
    path: "/dashboard/reports",
    icon: BarChart3,
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const user = useSelector((state: RootState) => state.auth.user);

  const { isMobile, setOpenMobile } = useSidebar();

  // Missing role means CUSTOMER (customer sessions carry no role field).
  const navigationItems = isAdmin(user)
    ? adminNavigationItems
    : isAgent(user)
    ? agentNavigationItems
    : customerNavigationItems;

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="flex items-center py-5 border-b border-sidebar-border">
        <SidebarMenuButton className="flex h-10 cursor-pointer items-center gap-3 text-sidebar-foreground hover:bg-transparent">
          <Image
            src="/logo.png"
            alt="Travel Trek Logo"
            width={40}
            height={40}
          />
          <span className="font-display text-xl font-semibold tracking-tight">
            Travel Trek
          </span>
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
                  className={`px-4 py-3 gap-4 rounded-lg hover:bg-sidebar-accent transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary font-medium"
                      : "text-sidebar-foreground/80"
                  }`}
                >
                  <Link
                    href={item.path}
                    className="flex items-center w-full"
                    onClick={handleLinkClick}
                  >
                    <item.icon
                      className={`h-5 w-5 ${
                        isActive ? "text-sidebar-primary" : "opacity-70"
                      }`}
                      strokeWidth={1.75}
                    />
                    <span className="ml-3">{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-sidebar-border">
        <div className="px-4 py-3 font-mono text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/50">
          TT-2026 · Tour system
        </div>
      </SidebarFooter>

      <SidebarRail className="w-1" />
    </Sidebar>
  );
}
