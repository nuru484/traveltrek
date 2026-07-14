// src/components/payments/table/columns.tsx
"use client";
import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  CreditCard,
  Smartphone,
  Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { IPayment } from "@/types/payment.types";
import { PaymentActionsDropdown } from "./PaymentActionsDropdown";
import DateCell from "@/components/ui/DateCell";
import { Money } from "@/components/ui/Money";

const getPaymentMethodIcon = (method: string) => {
  switch (method) {
    case "CREDIT_CARD":
    case "DEBIT_CARD":
      return <CreditCard className="w-4 h-4" />;
    case "MOBILE_MONEY":
      return <Smartphone className="w-4 h-4" />;
    case "BANK_TRANSFER":
      return <Building2 className="w-4 h-4" />;
    default:
      return <CreditCard className="w-4 h-4" />;
  }
};

const getStatusVariant = (status: IPayment["status"]) => {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "PENDING":
      return "outline";
    case "FAILED":
      return "destructive";
    case "REFUNDED":
      return "secondary";
    default:
      return "outline";
  }
};

const getPaymentMethodLabel = (method: string) => {
  return method.replace(/_/g, " ");
};

export const createPaymentColumns = (
  showActions: boolean = true,
  showUser: boolean = true,
  showBooking: boolean = true,
  userRole: "ADMIN" | "AGENT" | "CUSTOMER"
): ColumnDef<IPayment>[] => {
  const columns: ColumnDef<IPayment>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false },
    {
      accessorKey: "transactionReference",
      header: "Reference",
      cell: ({ row }) => {
        const reference = row.getValue("transactionReference") as string;
        return (
          <div className="font-mono text-sm max-w-[120px] truncate">
            {reference}
          </div>
        );
      } },
  ];

  // Conditionally add user column
  if (showUser) {
    columns.push({
      accessorKey: "user",
      header: "User",
      cell: ({ row }) => {
        const user = row.original.user;
        return (
          <div className="max-w-[200px] sm:max-w-[300px]">
            <div className="font-medium truncate text-sm sm:text-base">
              {user.name}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-1">
              {user.email}
            </div>
          </div>
        );
      } });
  }

  // Conditionally add booking column
  if (showBooking) {
    columns.push({
      accessorKey: "bookedItem",
      header: "Booked Item",
      cell: ({ row }) => {
        const item = row.original.bookedItem;
        return (
          <div className="max-w-[200px]">
            <div className="font-medium truncate text-sm">{item.name}</div>
            <Badge variant="outline" className="text-xs mt-1">
              {item.type}
            </Badge>
          </div>
        );
      } });
  }

  // Add remaining columns
  columns.push(
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const amount = row.getValue("amount") as number;
        const currency = row.original.currency;
        return (
          <div className="font-medium whitespace-nowrap">
            <Money amount={amount} symbol={currency === "GHS" ? "₵" : "$"} />
          </div>
        );
      } },
    {
      accessorKey: "paymentMethod",
      header: "Payment Method",
      cell: ({ row }) => {
        const method = row.getValue("paymentMethod") as string;
        return (
          <div className="flex items-center gap-2">
            {getPaymentMethodIcon(method)}
            <span className="text-sm">{getPaymentMethodLabel(method)}</span>
          </div>
        );
      } },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as IPayment["status"];
        return (
          <Badge variant={getStatusVariant(status)} className="text-xs">
            {status}
          </Badge>
        );
      } },
    {
      accessorKey: "paymentDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <span className="hidden sm:inline">Payment Date</span>
          <ArrowUpDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        return <DateCell value={row.getValue("paymentDate") as Date | null} />;
      } },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <span className="hidden sm:inline">Created</span>
          <ArrowUpDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        return <DateCell value={row.getValue("createdAt") as Date} />;
      } }
  );

  if (showActions) {
    columns.push({
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <PaymentActionsDropdown payment={row.original} userRole={userRole} />
      ) });
  }

  return columns;
};
