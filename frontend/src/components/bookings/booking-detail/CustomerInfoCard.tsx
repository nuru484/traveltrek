// src/components/bookings/booking-detail/CustomerInfoCard.tsx
//
// Customer information card: name, email, and a link to the customer profile.
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, User } from "lucide-react";
import { IBooking } from "@/types/booking.types";

export function CustomerInfoCard({ booking }: { booking: IBooking }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Customer Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2">
          <div className="min-w-0">
            <label className="text-sm font-medium text-muted-foreground">
              Name
            </label>
            <p className="text-sm font-medium break-words [overflow-wrap:anywhere]">
              {booking.customer.name}
            </p>
          </div>
          <div className="min-w-0">
            <label className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <p className="text-sm break-all">
              {booking.customer.email || "No email"}
            </p>
          </div>
        </div>
        <Separator />
        <Link
          href={`/dashboard/customers/${booking.customerId}`}
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
        >
          View Customer Profile
          <ExternalLink className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
