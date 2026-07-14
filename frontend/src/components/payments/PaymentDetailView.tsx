// src/components/payments/PaymentDetailView.tsx
import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IPayment } from "@/types/payment.types";

interface PaymentDetailViewProps {
  payment: IPayment;
  userRole?: "ADMIN" | "USER" | "MANAGER";
}

const formatCurrency = (amount: number, currency: string = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount
  );

const formatDate = (dateString: Date | string | null) => {
  if (!dateString) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};

/** One mono-labelled record field. */
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

/** Mono section label with a trailing hairline. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {children}
      </span>
      <div className="hidden h-px flex-1 bg-foreground/15 sm:block" />
    </div>
  );
}

/**
 * The payment as a receipt-style record: night strip, serif amount, and
 * dense mono-labelled field grids — no icon chips, no one-field-per-row
 * dead space.
 */
const PaymentDetailView: React.FC<PaymentDetailViewProps> = ({
  payment,
  userRole = "USER",
}) => {
  const isAdmin = userRole === "ADMIN" || userRole === "MANAGER";
  const bookedType =
    payment.bookedItem.type.charAt(0) +
    payment.bookedItem.type.slice(1).toLowerCase();

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/15 bg-card">
      {/* Receipt strip */}
      <div className="flex items-center justify-between gap-3 bg-night px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground sm:px-6">
        <span className="truncate">Travel Trek · Payment receipt</span>
        <span className="flex-none text-night-foreground/70">
          {payment.status}
        </span>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {/* Amount */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Amount
            </p>
            <p className="mt-1 break-words font-display text-4xl font-semibold tracking-tight text-foreground">
              {formatCurrency(payment.amount, payment.currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {payment.paymentDate
                ? `Paid on ${formatDate(payment.paymentDate)}`
                : `Created on ${formatDate(payment.createdAt)}`}
            </p>
          </div>
          <Badge variant="outline">{payment.status}</Badge>
        </div>

        {/* Payment record */}
        <div className="space-y-3">
          <SectionLabel>Payment</SectionLabel>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
            <Field label="Method">
              {payment.paymentMethod.replace(/_/g, " ")}
            </Field>
            <Field label="Reference">
              <span className="font-mono text-[13px]">
                {payment.transactionReference || "—"}
              </span>
            </Field>
            {payment.paymentDate && (
              <Field label="Payment date">
                {formatDate(payment.paymentDate)}
              </Field>
            )}
          </dl>
        </div>

        {/* Customer */}
        <div className="space-y-3 border-t border-dashed border-foreground/20 pt-5">
          <SectionLabel>Customer</SectionLabel>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
            <Field label="Name">{payment.user.name}</Field>
            <Field label="Email">
              <span className="break-all">{payment.user.email}</span>
            </Field>
            <Field label="Profile">
              <Link
                href={`/dashboard/users/${payment.userId}/user-profile`}
                className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
              >
                View customer profile
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            </Field>
          </dl>
        </div>

        {/* Booked item */}
        <div className="space-y-3 border-t border-dashed border-foreground/20 pt-5">
          <SectionLabel>Booked item</SectionLabel>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
            <Field label="Type">{bookedType}</Field>
            <Field label="Name" className="min-[480px]:col-span-1 lg:col-span-2">
              {payment.bookedItem.name}
            </Field>
            {payment.bookedItem.description && (
              <Field label="Description" className="col-span-full">
                <span className="font-normal text-muted-foreground">
                  {payment.bookedItem.description}
                </span>
              </Field>
            )}
            <Field label="Booking">
              <Link
                href={`/dashboard/bookings/${payment.bookingId}`}
                className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
              >
                View related booking
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            </Field>
          </dl>
        </div>

        {/* Admin timeline */}
        {isAdmin && (
          <p className="border-t border-dashed border-foreground/20 pt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Created · {formatDate(payment.createdAt)} — Last updated ·{" "}
            {formatDate(payment.updatedAt)}
          </p>
        )}
      </div>
    </div>
  );
};

export default PaymentDetailView;
