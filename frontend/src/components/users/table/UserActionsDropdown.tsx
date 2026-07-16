// src/components/users/table/UserActionsDropdown.tsx
"use client";
import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Trash2, Shield, User, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { IUser, StaffRole } from "@/types/user.types";
import {
  useUpdateUserRoleMutation,
  useDeleteUserMutation,
} from "@/redux/userApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface UserActionsDropdownProps {
  user: IUser;
}

export function UserActionsDropdown({ user }: UserActionsDropdownProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [updateUserRole] = useUpdateUserRoleMutation();
  const [deleteUser] = useDeleteUserMutation();

  const handleChangeRole = async (newRole: StaffRole) => {
    const toastId = toast.loading(`Changing role to ${newRole}...`);

    try {
      await updateUserRole({ userId: user.id, role: newRole }).unwrap();
      toast.dismiss(toastId);
      toast.success(`User role changed to ${newRole} successfully`);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message);
    }
  };

  const handleDeleteUser = async () => {
    const toastId = toast.loading("Deleting user...");

    try {
      await deleteUser(user.id).unwrap();
      toast.dismiss(toastId);
      toast.success("User deleted successfully");
      setDeleteDialogOpen(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message);
      setDeleteDialogOpen(false);
    }
  };

  const roleOptions: { value: StaffRole; label: string }[] = [
    { value: "ADMIN", label: "Admin" },
    { value: "AGENT", label: "Agent" },
  ];

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

          {/* View User Details */}
          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/users/${user.id}/user-profile`}
              className="hover:cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>

          {/* Edit User Details */}
          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/users/${user.id}/edit-profile`}
              className="hover:cursor-pointer"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Details
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Update Role Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="hover:cursor-pointer">
              <Shield className="mr-2 h-4 w-4" />
              Update Role
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {roleOptions.map((role) => (
                <DropdownMenuItem
                  key={role.value}
                  className="hover:cursor-pointer"
                  onClick={() => handleChangeRole(role.value)}
                  disabled={user.role === role.value}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  {role.label}
                  {user.role === role.value && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Current
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-red-600 hover:cursor-pointer"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Staff
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Staff"
        description={`Are you sure you want to delete "${user.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteUser}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
      />
    </>
  );
}
