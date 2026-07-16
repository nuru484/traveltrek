// src/components/customers/table/columns.tsx
"use client";
import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ICustomer } from "@/types/customer.types";
import { CustomerActionsDropdown } from "./CustomerActionsDropdown";
import DateCell from "@/components/ui/DateCell";

export const createCustomerColumns = (
  isAdmin: boolean
): ColumnDef<ICustomer>[] => [
  {
    accessorKey: "profilePicture",
    header: "Image",
    cell: ({ row }) => {
      const profilePicture = row.getValue("profilePicture") as
        | string
        | undefined;
      return (
        <div className="w-10 h-10 sm:w-12 sm:h-12 relative rounded-md overflow-hidden bg-muted flex items-center justify-center">
          {profilePicture ? (
            <Image
              src={profilePicture}
              alt="Profile"
              fill
              className="object-cover"
            />
          ) : (
            <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 h-auto font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground hover:bg-transparent hover:text-foreground text-left justify-start"
      >
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const name = row.getValue("name") as string;
      const email = row.original.email;
      return (
        <div className="max-w-[200px] sm:max-w-[300px]">
          <div className="font-medium truncate text-sm sm:text-base">
            {name}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-1 break-all">
            {email || "No email"}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => {
      const phone = row.getValue("phone") as string | undefined;
      return (
        <span className="text-xs sm:text-sm whitespace-nowrap">
          {phone || "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "address",
    header: () => <span className="hidden lg:inline">Address</span>,
    cell: ({ row }) => {
      const address = row.getValue("address") as string | undefined;
      return (
        <span
          title={address}
          className="text-xs sm:text-sm text-muted-foreground hidden lg:block truncate max-w-[180px]"
        >
          {address || "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 h-auto font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <span>Member Since</span>
        <ArrowUpDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      return <DateCell value={row.getValue("createdAt") as string} />;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => (
      <CustomerActionsDropdown customer={row.original} isAdmin={isAdmin} />
    ),
  },
];
