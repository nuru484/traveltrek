// src/components/payments/PaymentDetailView.tsx
import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IPayment } from "@/types/payment.types";
import { formatMoney } from "@/utils/format-money";

interface PaymentDetailViewProps {
  payment: IPayment;
  userRole?: "ADMIN" | "USER" | "MANAGER";
}


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

/** Manifest row: mono label, dotted leader, value — the landing's cargo-manifest device. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
      <span className="flex-none font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <span
        aria-hidden
        className="hidden min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-foreground/25 sm:block"
      />
      <span className="min-w-0 break-words text-sm font-medium text-foreground sm:max-w-[65%] sm:text-right">
        {children}
      </span>
    </div>
  );
}

/** CSS barcode — the receipt's signature texture. */
const Barcode = () => (
  <div
    aria-hidden
    className="h-10 w-full text-foreground/80"
    style={{
      backgroundImage:
        "repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px, currentColor 5px 6px, transparent 6px 8px, currentColor 8px 11px, transparent 11px 15px, currentColor 15px 16px, transparent 16px 19px)",
    }}
  />
);

/**
 * The payment as a boarding-pass receipt: night strip, a hero band with the
 * serif amount and a barcode stub, then manifest-style rows with dotted
 * leaders — typographic, not tabular.
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
          Nº {payment.id}
        </span>
      </div>

      {/* Amount hero on the paper band, with a tear-off stub */}
      <div className="flex flex-col gap-6 bg-hero-band px-4 py-6 sm:px-6 min-[560px]:flex-row min-[560px]:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Amount
          </p>
          <p className="mt-1 break-words font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {formatMoney(payment.amount, { exact: true })}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{payment.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {payment.paymentDate
                ? `Paid on ${formatDate(payment.paymentDate)}`
                : `Created on ${formatDate(payment.createdAt)}`}
            </span>
          </div>
        </div>
        <div className="w-full flex-none border-t border-dashed border-foreground/25 pt-4 min-[560px]:w-44 min-[560px]:border-l min-[560px]:border-t-0 min-[560px]:pl-5 min-[560px]:pt-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {payment.paymentMethod.replace(/_/g, " ")}
          </p>
          <div className="mt-2">
            <Barcode />
          </div>
          <p className="mt-2 break-all font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            {payment.transactionReference || "No reference"}
          </p>
        </div>
      </div>

      {/* Records */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-6 p-4 sm:p-6 @4xl/main:grid-cols-2">
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            Customer
          </p>
          <div className="space-y-2.5">
            <Row label="Name">{payment.customer.name}</Row>
            <Row label="Email">
              <span className="break-all">
                {payment.customer.email || "No email"}
              </span>
            </Row>
            <Row label="Profile">
              <Link
                href={`/dashboard/customers/${payment.customerId}`}
                className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                View profile
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            </Row>
          </div>
        </div>

        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            Booked item
          </p>
          <div className="space-y-2.5">
            <Row label="Type">{bookedType}</Row>
            <Row label="Name">{payment.bookedItem.name}</Row>
            <Row label="Booking">
              <Link
                href={`/dashboard/bookings/${payment.bookingId}`}
                className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                View booking
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            </Row>
          </div>
        </div>

        {payment.bookedItem.description && (
          <div className="space-y-2 lg:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Description
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {payment.bookedItem.description}
            </p>
          </div>
        )}

        {isAdmin && (
          <p className="border-t border-dashed border-foreground/20 pt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground lg:col-span-2">
            Created · {formatDate(payment.createdAt)} — Last updated ·{" "}
            {formatDate(payment.updatedAt)}
          </p>
        )}
      </div>
    </div>
  );
};

export default PaymentDetailView;
