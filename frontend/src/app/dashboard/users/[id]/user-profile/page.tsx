// src/app/dashboard/users/[id]/user-profile/page.tsx
//
// STAFF profile: /users/:userId is staff-only on the backend, so this page
// shows the account record only — bookings/payments belong to customers and
// live on /dashboard/customers/[id].
"use client";
import UserProfileHeader from "@/components/users/UserProfileHeader";
import { useGetUserQuery } from "@/redux/userApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import UserProfileHeaderSkeleton from "@/components/users/UserProfileHeaderSkeleton";
import { useParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";

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

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-8 py-6">
        <UserProfileHeaderSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-8 py-6">
        <ErrorMessage
          error={extractApiErrorMessage(error).message}
          onRetry={refetch}
        />
      </div>
    );
  }

  const user = userData?.data ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 py-6">
      <UserProfileHeader user={user} currentUser={currentUser} />
    </div>
  );
};

export default UserProfilePage;
