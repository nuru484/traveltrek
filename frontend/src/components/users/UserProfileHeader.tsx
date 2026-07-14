"use client";
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Crown,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { IUser } from "@/types/user.types";

type UserProfileHeaderProps = {
  user?: IUser | null;
  currentUser?: IUser | null;
};

export function UserProfileHeader({
  user,
  currentUser,
}: UserProfileHeaderProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return isNaN(date.getTime())
      ? "N/A"
      : date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
  };

  const getRoleConfig = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return {
          color:
            " -500/10 -500/10 text-red-600 border-red-200",
          icon: Crown,
          label: "Admin",
        };
      case "AGENT":
        return {
          color:
            " -500/10 -500/10 text-blue-600 border-blue-200",
          icon: Shield,
          label: "Agent",
        };
      case "CUSTOMER":
      default:
        return {
          color:
            " -500/10 -500/10 text-emerald-600 border-emerald-200",
          icon: User,
          label: "Customer",
        };
    }
  };

  const getUserInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const isAdmin = currentUser?.role === "ADMIN";
  const isViewingOwnProfile = currentUser?.id === user?.id;

  if (!user) {
    return (
      <Card className="w-full rounded-b-none">
        <CardContent className="flex items-center justify-center p-4 lg:p-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-muted-foreground">
              No user data available
            </h3>
            <p className="text-sm text-muted-foreground">
              Please check back later or contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const roleConfig = getRoleConfig(user.role);
  const RoleIcon = roleConfig.icon;

  return (
    <Card className="space-y-4 container mx-auto border-0 rounded-b-none">
      <CardContent className="p-0">
        {/* Header Banner */}
        <div
          className="h-32 bg-cover bg-center relative overflow-hidden"
          style={{ backgroundImage: "url('/assets/hero-travel.jpg')" }}
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        </div>

        {/* Main Content */}
        <div className="relative px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Avatar Section */}
            <div className="flex-shrink-0 mx-auto lg:mx-0">
              <div className="relative">
                <Avatar className="h-32 w-32 border-4 border-background">
                  <AvatarImage
                    src={user.profilePicture || undefined}
                    alt={`${user.name ?? "User"} profile picture`}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-primary-foreground text-2xl font-bold">
                    {getUserInitials(user.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Status Indicator */}
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full border-4 border-background flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* User Information */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Name and Role */}
              <div className="text-center lg:text-left space-y-3">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold text-foreground tracking-tight break-all">
                    {user.name ?? "Unknown User"}
                  </h1>
                  {(isAdmin || isViewingOwnProfile) && (
                    <Badge
                      variant="outline"
                      className={`${roleConfig.color} font-medium`}
                    >
                      <RoleIcon className="w-3 h-3 mr-1.5" />
                      {roleConfig.label}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="group">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Email Address
                      </p>
                      <p className="text-base font-medium text-foreground truncate">
                        {user.email ?? "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="group">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                      <Phone className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Phone Number
                      </p>
                      <p className="text-base font-medium text-foreground">
                        {user.phone ?? "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="group">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                      <MapPin className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Location
                      </p>
                      <p className="text-base font-medium text-foreground">
                        {user.address ?? "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="group">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Member Since
                      </p>
                      <p className="text-base font-medium text-foreground">
                        {formatDate(user.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Badges - Only show to admins or own profile */}
              {(isAdmin || isViewingOwnProfile) && (
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1.5" />
                    Active Account
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  >
                    <Shield className="w-3 h-3 mr-1.5" />
                    Verified
                  </Badge>
                </div>
              )}

              {/* Admin-only information */}
              {isAdmin && (
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Last updated: {formatDate(user.updatedAt)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default UserProfileHeader;
