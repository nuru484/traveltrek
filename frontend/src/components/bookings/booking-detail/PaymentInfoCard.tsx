// src/components/bookings/booking-detail/PaymentInfoCard.tsx
//
// Payment information card: amount, status badge, method, and payment id.
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";
import { IBooking } from "@/types/booking.types";
import { formatMoney } from "@/utils/format-money";
import { getPaymentStatusColor } from "./format";

export function PaymentInfoCard({
  payment,
}: {
  payment: NonNullable<IBooking["payment"]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Payment Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Amount
            </label>
            <p className="text-lg font-semibold">
              {formatMoney(payment.amount, { exact: true })}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status
            </label>
            <Badge
              variant="secondary"
              className={getPaymentStatusColor(payment.status)}
            >
              {payment.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Method
            </label>
            <p className="text-sm font-medium">
              {payment.paymentMethod.replace("_", " ")}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Payment ID
            </label>
            <p className="text-sm text-muted-foreground font-mono">
              #{payment.id}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
