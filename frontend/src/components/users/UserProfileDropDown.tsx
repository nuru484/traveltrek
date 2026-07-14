"use client";
import * as React from "react";
import Link from "next/link";
import { User, Settings, LogOut, Edit } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLogoutMutation } from "@/redux/auth/authApi";
import toast from "react-hot-toast";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { useRouter } from "next/navigation";

export function UserProfileDropdown() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);

  const [logout, { isLoading }] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
      router.push("/login");
      toast.success("Logout successful");
    } catch (error) {
      toast.error(extractApiErrorMessage(error).message);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity border border-foreground">
          <AvatarImage src={user.profilePicture} alt={user.name} />
          <AvatarFallback className="text-sm">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex min-w-0 flex-col space-y-1">
            <p className="truncate text-sm font-medium leading-none">{user.name}</p>
            <p className="truncate text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href={`/dashboard/users/${user.id}/user-profile`}
            className="cursor-pointer"
          >
            <User className="mr-2 h-4 w-4" />
            <span>View Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`/dashboard/users/${user.id}/edit-profile?userId=${user.id}`}
            className="cursor-pointer"
          >
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          {/* <Link href="/settings" className="cursor-pointer"> */}
          <div>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </div>

          {/* </Link> */}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isLoading ? "Logging out..." : "Logout"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
