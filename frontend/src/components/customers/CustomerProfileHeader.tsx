// src/components/customers/CustomerProfileHeader.tsx
"use client";
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import EmptyState from "@/components/ui/EmptyState";
import { ICustomerProfile } from "@/types/customer.types";
import { BookOpen, CreditCard } from "lucide-react";

type CustomerProfileHeaderProps = {
  customer?: ICustomerProfile | null;
};

/** One labelled field, in the boarding-pass voice. */
function ProfileField({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value?: string | null;
  breakAll?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm font-medium text-foreground ${
          breakAll ? "break-all" : "break-words [overflow-wrap:anywhere]"
        }`}
      >
        {value || "Not provided"}
      </dd>
    </div>
  );
}

/** Lifetime activity counter tile. */
function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-foreground/15 bg-muted/30 px-4 py-3">
      <Icon className="h-5 w-5 flex-none text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * The customer profile as a passenger record: night strip, avatar with the
 * name, mono-labelled fields, and lifetime activity tiles from the profile
 * DTO's stats block.
 */
export function CustomerProfileHeader({
  customer,
}: CustomerProfileHeaderProps) {
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

  const getInitials = (name?: string) => {
    if (!name) return "C";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  if (!customer) {
    return (
      <EmptyState
        eyebrow="No record"
        title="No customer data available."
        description="Please check back later or contact support."
        className="rounded-xl border border-foreground/15 bg-card"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/15 bg-card">
      {/* Record strip */}
      <div className="flex items-center justify-between bg-night px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] min-[400px]:text-[10px] min-[400px]:tracking-[0.2em] text-night-foreground sm:px-6">
        <span className="min-w-0 truncate">Travel Trek · Customer record</span>
        <span className="flex-none text-night-foreground/70">
          Nº {customer.id}
        </span>
      </div>

      <div className="p-4 sm:p-6">
        {/* Identity */}
        <div className="flex flex-col items-center gap-4 text-center min-[480px]:flex-row min-[480px]:items-center min-[480px]:text-left">
          <Avatar className="h-20 w-20 flex-none border border-foreground/15 sm:h-24 sm:w-24">
            <AvatarImage
              src={customer.profilePicture || undefined}
              alt={`${customer.name} profile picture`}
              className="object-cover"
            />
            <AvatarFallback className="bg-muted font-display text-2xl font-semibold text-foreground">
              {getInitials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="break-words [overflow-wrap:anywhere] text-xl font-semibold tracking-tight min-[400px]:text-2xl sm:text-3xl">
              {customer.name}
            </h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Member since {formatDate(customer.createdAt)}
            </p>
          </div>
        </div>

        {/* Lifetime activity */}
        <div className="mt-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          <StatTile
            label="Total bookings"
            value={customer.stats.totalBookings}
            icon={BookOpen}
          />
          <StatTile
            label="Total payments"
            value={customer.stats.totalPayments}
            icon={CreditCard}
          />
        </div>

        {/* Record fields */}
        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-dashed border-foreground/20 pt-5 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
          <ProfileField label="Email" value={customer.email} breakAll />
          <ProfileField label="Phone" value={customer.phone} />
          <ProfileField label="Address" value={customer.address} />
          <ProfileField
            label="Last updated"
            value={formatDate(customer.updatedAt)}
          />
        </dl>
      </div>
    </div>
  );
}

export default CustomerProfileHeader;
