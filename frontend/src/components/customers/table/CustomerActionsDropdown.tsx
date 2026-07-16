// src/components/customers/table/CustomerActionsDropdown.tsx
"use client";
import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Trash2, User, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ICustomer } from "@/types/customer.types";
import { useDeleteCustomerMutation } from "@/redux/customerApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface CustomerActionsDropdownProps {
  customer: ICustomer;
  /** DELETE /customers/:id is ADMIN-only; agents don't see the action. */
  isAdmin: boolean;
}

export function CustomerActionsDropdown({
  customer,
  isAdmin,
}: CustomerActionsDropdownProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteCustomer] = useDeleteCustomerMutation();

  const handleDeleteCustomer = async () => {
    const toastId = toast.loading("Deleting customer...");

    try {
      await deleteCustomer(customer.id).unwrap();
      toast.dismiss(toastId);
      toast.success("Customer deleted successfully");
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message);
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 hover:cursor-pointer">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/customers/${customer.id}`}
              className="hover:cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/customers/${customer.id}/edit`}
              className="hover:cursor-pointer"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Details
            </Link>
          </DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 hover:cursor-pointer"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Customer
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Customer"
        description={`Are you sure you want to delete "${customer.name}"? Their bookings and payments will no longer appear in listings. This action cannot be undone.`}
        onConfirm={handleDeleteCustomer}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
      />
    </>
  );
}
