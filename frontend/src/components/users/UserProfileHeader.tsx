"use client";
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/ui/EmptyState";
import { IUser } from "@/types/user.types";

type UserProfileHeaderProps = {
  user?: IUser | null;
  currentUser?: IUser | null;
};

/** One labelled field, in the boarding-pass voice. */
function ProfileField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">
        {value || "Not provided"}
      </dd>
    </div>
  );
}

/**
 * The profile header as a passenger record: night strip, avatar with serif
 * name, and mono-labelled fields — no photo banner, no icon chips.
 */
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
  const canSeeStatus = isAdmin || isViewingOwnProfile;

  if (!user) {
    return (
      <EmptyState
        eyebrow="No record"
        title="No user data available."
        description="Please check back later or contact support."
        className="rounded-xl border border-foreground/15 bg-card"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/15 bg-card">
      {/* Record strip */}
      <div className="flex items-center justify-between bg-night px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] min-[400px]:text-[10px] min-[400px]:tracking-[0.2em] text-night-foreground sm:px-6">
        <span className="min-w-0 truncate">Travel Trek · Passenger record</span>
        {canSeeStatus && (
          <span className="text-night-foreground/70">{user.role}</span>
        )}
      </div>

      <div className="p-4 sm:p-6">
        {/* Identity */}
        <div className="flex flex-col items-center gap-4 text-center min-[480px]:flex-row min-[480px]:items-center min-[480px]:text-left">
          <Avatar className="h-20 w-20 flex-none border border-foreground/15 sm:h-24 sm:w-24">
            <AvatarImage
              src={user.profilePicture || undefined}
              alt={`${user.name ?? "User"} profile picture`}
              className="object-cover"
            />
            <AvatarFallback className="bg-muted font-display text-2xl font-semibold text-foreground">
              {getUserInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="break-words [overflow-wrap:anywhere] text-xl font-semibold tracking-tight min-[400px]:text-2xl sm:text-3xl">
              {user.name ?? "Unknown User"}
            </h2>
            {canSeeStatus && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5 min-[480px]:justify-start">
                <Badge variant="outline">Active</Badge>
                <Badge variant="outline">Verified</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Record fields */}
        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-dashed border-foreground/20 pt-5 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
          <ProfileField label="Email" value={user.email} />
          <ProfileField label="Phone" value={user.phone} />
          <ProfileField label="Address" value={user.address} />
          <ProfileField label="Member since" value={formatDate(user.createdAt)} />
        </dl>

        {isAdmin && (
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Last updated · {formatDate(user.updatedAt)}
          </p>
        )}
      </div>
    </div>
  );
}

export default UserProfileHeader;
