// src/components/payments/PaymentDetailView.tsx
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  DollarSign,
  User,
  Mail,
  ExternalLink,
  CreditCard,
  Receipt,
  Building2,
  MapPin,
  Plane,
  Bed,
  Hash,
} from "lucide-react";
import { IPayment } from "@/types/payment.types";

interface PaymentDetailViewProps {
  payment: IPayment;
  userRole?: "ADMIN" | "USER" | "MANAGER";
}

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "COMPLETED":
      return "bg-green-100 text-green-800 border-green-200";
    case "FAILED":
      return "bg-red-100 text-red-800 border-red-200";
    case "REFUNDED":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getPaymentMethodIcon = (method: string) => {
  switch (method) {
    case "CREDIT_CARD":
    case "DEBIT_CARD":
      return <CreditCard className="h-4 w-4 text-muted-foreground" />;
    case "MOBILE_MONEY":
      return <Receipt className="h-4 w-4 text-muted-foreground" />;
    case "BANK_TRANSFER":
      return <Building2 className="h-4 w-4 text-muted-foreground" />;
    default:
      return <DollarSign className="h-4 w-4 text-muted-foreground" />;
  }
};

const getBookingTypeIcon = (type: string) => {
  switch (type) {
    case "TOUR":
      return <MapPin className="h-5 w-5 text-primary" />;
    case "FLIGHT":
      return <Plane className="h-5 w-5 text-primary" />;
    case "ROOM":
    case "HOTEL":
      return <Bed className="h-5 w-5 text-primary" />;
    default:
      return <Calendar className="h-5 w-5 text-primary" />;
  }
};

const formatCurrency = (amount: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

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

const PaymentDetailView: React.FC<PaymentDetailViewProps> = ({
  payment,
  userRole = "USER",
}) => {
  const isAdmin = userRole === "ADMIN" || userRole === "MANAGER";

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-2xl font-semibold">
                  Payment Details
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {payment.paymentDate
                    ? `Paid on ${formatDate(payment.paymentDate)}`
                    : `Created on ${formatDate(payment.createdAt)}`}
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={getPaymentStatusColor(payment.status)}
            >
              {payment.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Name
                </label>
                <p className="text-sm font-medium break-all">
                  {payment.user.name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm break-all">{payment.user.email}</p>
                </div>
              </div>
            </div>
            <Separator />
            <Link
              href={`/dashboard/users/${payment.userId}/user-profile`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              View Customer Profile
              <ExternalLink className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Amount
              </span>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-lg font-bold text-green-600">
                  {formatCurrency(payment.amount, payment.currency)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Payment Method
              </label>
              <div className="flex items-center gap-2">
                {getPaymentMethodIcon(payment.paymentMethod)}
                <p className="text-sm font-medium">
                  {payment.paymentMethod.replace("_", " ")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Transaction Reference
              </label>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-mono text-foreground">
                  {payment.transactionReference}
                </p>
              </div>
            </div>

            {payment.paymentDate && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Payment Date
                </label>
                <p className="text-sm">{formatDate(payment.paymentDate)}</p>
              </div>
            )}

            <Separator />

            <Link
              href={`/dashboard/bookings/${payment.bookingId}`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              View Related Booking
              <ExternalLink className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Booked Item Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getBookingTypeIcon(payment.bookedItem.type)}
            Booked Item Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Type
            </label>
            <div className="flex items-center gap-2">
              {getBookingTypeIcon(payment.bookedItem.type)}
              <p className="font-medium">
                {payment.bookedItem.type.charAt(0) +
                  payment.bookedItem.type.slice(1).toLowerCase()}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Name
            </label>
            <p className="font-medium break-all">{payment.bookedItem.name}</p>
          </div>

          {payment.bookedItem.description && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Description
              </label>
              <p className="text-sm text-muted-foreground break-all">
                {payment.bookedItem.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timestamps - Only for Admin */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Payment Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Created
                </label>
                <p className="text-sm">{formatDate(payment.createdAt)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Last Updated
                </label>
                <p className="text-sm">{formatDate(payment.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentDetailView;
