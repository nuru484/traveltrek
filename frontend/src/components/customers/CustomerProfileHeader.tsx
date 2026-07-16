// src/components/customers/CustomerProfileHeader.tsx
"use client";
import React from "react";
import { Mail, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/ui/EmptyState";
import {
  CustomerSignupMethod,
  ICustomerProfile,
} from "@/types/customer.types";

type CustomerProfileHeaderProps = {
  customer?: ICustomerProfile | null;
  /** Role-gated actions (edit/delete) rendered inside the record card. */
  actions?: React.ReactNode;
};

const SIGNUP_LABEL: Record<CustomerSignupMethod, string> = {
  google: "Via Google",
  email: "Via e-mail",
  phone: "Via phone",
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
          breakAll ? "break-all" : "[overflow-wrap:anywhere]"
        }`}
      >
        {value || "Not provided"}
      </dd>
    </div>
  );
}

/** Compact contact chip; unbroken tokens (emails) wrap safely. */
function ContactChip({
  icon: Icon,
  value,
  breakAll = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-foreground/15 bg-muted/30 px-2.5 py-1 text-xs text-foreground">
      <Icon className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden />
      <span
        className={`min-w-0 ${breakAll ? "break-all" : "[overflow-wrap:anywhere]"}`}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * The customer profile as a passenger record: night strip, avatar + name with
 * contact chips and the signup-method badge, role-gated actions, and the
 * mono-labelled record fields. Lifetime activity lives in CustomerStats.
 */
export function CustomerProfileHeader({
  customer,
  actions,
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
        {/* Identity + role-gated actions */}
        <div className="flex flex-col gap-5 @3xl/main:flex-row @3xl/main:items-start @3xl/main:justify-between">
          <div className="flex min-w-0 flex-col items-center gap-4 text-center min-[480px]:flex-row min-[480px]:items-start min-[480px]:text-left">
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
              <h1 className="[overflow-wrap:anywhere] text-xl font-semibold tracking-tight min-[400px]:text-2xl sm:text-3xl">
                {customer.name}
              </h1>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Member since {formatDate(customer.stats.memberSince)}
              </p>

              {/* Contact chips + signup method */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 min-[480px]:justify-start">
                <Badge variant="default">
                  {SIGNUP_LABEL[customer.stats.signupMethod]}
                </Badge>
                {customer.email && (
                  <ContactChip icon={Mail} value={customer.email} breakAll />
                )}
                {customer.phone && (
                  <ContactChip icon={Phone} value={customer.phone} />
                )}
              </div>
            </div>
          </div>

          {actions && (
            <div className="flex flex-none flex-wrap items-center justify-center gap-2 min-[480px]:justify-start">
              {actions}
            </div>
          )}
        </div>

        {/* Record fields */}
        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-dashed border-foreground/20 pt-5 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
          <ProfileField label="Address" value={customer.address} />
          <ProfileField
            label="Last updated"
            value={formatDate(customer.updatedAt)}
          />
          <ProfileField label="Record no." value={`CUS-${customer.id}`} />
        </dl>
      </div>
    </div>
  );
}

export default CustomerProfileHeader;
