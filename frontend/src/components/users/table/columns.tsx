// src/components/users/table/columns.tsx
"use client";
import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { IUser, UserRole } from "@/types/user.types";
import { UserActionsDropdown } from "./UserActionsDropdown";
import DateCell from "@/components/ui/DateCell";

export const createUserColumns = (): ColumnDef<IUser>[] => [
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
    accessorKey: "profilePicture",
    header: "Image",
    cell: ({ row }) => {
      const profilePicture = row.getValue("profilePicture") as string | null;
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
    enableSorting: false },
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
          <div className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-1">
            {email}
          </div>
        </div>
      );
    } },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as UserRole;
      return (
        <Badge
          variant={
            role === "ADMIN"
              ? "default"
              : role === "AGENT"
              ? "secondary"
              : "outline"
          }
          className="text-xs"
        >
          {role}
        </Badge>
      );
    } },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => {
      const phone = row.getValue("phone") as string;
      return <span className="text-xs sm:text-sm">{phone}</span>;
    } },
  {
    accessorKey: "address",
    header: () => <span className="hidden lg:inline">Address</span>,
    cell: ({ row }) => {
      const address = row.getValue("address") as string;
      return (
        <span className="text-xs sm:text-sm text-muted-foreground hidden lg:inline truncate max-w-[150px]">
          {address}
        </span>
      );
    } },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 h-auto font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <span className="hidden sm:inline">Created At</span>
        <ArrowUpDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      return <DateCell value={row.getValue("createdAt") as string} />;
    } },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <UserActionsDropdown user={row.original} /> },
];
