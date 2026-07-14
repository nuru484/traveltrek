// src/app/dashboard/users/[id]/user-profile/page.tsx
"use client";
import UserProfileHeader from "@/components/users/UserProfileHeader";
import { useGetUserQuery } from "@/redux/userApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import UserProfileHeaderSkeleton from "@/components/users/UserProfileHeaderSkeleton";
import { useParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { UserProfileBookings } from "@/components/bookings/UserProfileBookings";
import { UserProfilePayments } from "@/components/payments/UserProfilePayments";

const UserProfilePage = () => {
  const params = useParams<{ id: string }>();
  const userId = parseInt(params.id, 10);

  const currentUser = useSelector((state: RootState) => state.auth.user);

  const {
    data: userData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetUserQuery({ userId });

  const errorMessage = extractApiErrorMessage(error).message;

  const isViewingOwnProfile = currentUser?.id === userId;
  const isAdmin = currentUser?.role === "ADMIN";

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl max-w-6xl space-y-8 py-6">
        <UserProfileHeaderSkeleton />
        <div className="space-y-6">
          <UserProfileBookings userId={userId} />
          <UserProfilePayments userId={userId} />
        </div>
      </div>
    );
  }

  if (isError && isViewingOwnProfile && currentUser) {
    return (
      <div className="mx-auto w-full max-w-7xl max-w-6xl space-y-8 py-6">
        <UserProfileHeader user={currentUser} currentUser={currentUser} />
        <div className="space-y-6">
          <UserProfileBookings userId={userId} />
          <UserProfilePayments userId={userId} />
        </div>
      </div>
    );
  }

  if (isError && isAdmin) {
    return (
      <div className="mx-auto w-full max-w-7xl max-w-6xl space-y-8 py-6">
        <ErrorMessage error={errorMessage} onRetry={refetch} />
        <div className="space-y-6">
          <UserProfileBookings userId={userId} />
          <UserProfilePayments userId={userId} />
        </div>
      </div>
    );
  }

  const user = userData?.data ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl max-w-6xl space-y-8 py-6">
      <UserProfileHeader user={user} currentUser={currentUser} />
      <div className="space-y-6">
        <UserProfileBookings userId={userId} />
        <UserProfilePayments userId={userId} />
      </div>
    </div>
  );
};

export default UserProfilePage;
