// src/app/dashboard/users/[id]/edit-profile/page.tsx
"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetUserQuery } from "@/redux/userApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import UserForm from "@/components/users/UserForm";
import FormSkeleton from "@/components/ui/FormSkeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function EditUserPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const searchUserId = searchParams.get("userId");
  const effectiveUserId = searchUserId
    ? parseInt(searchUserId, 10)
    : parseInt(params.id, 10);

  const {
    data: userData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetUserQuery({ userId: effectiveUserId });

  const user = userData?.data;
  const errorMessage = extractApiErrorMessage(error).message;

  // ✅ Dynamic title based on search params
  const isMyProfile = Boolean(searchUserId);
  const pageTitle = isMyProfile ? "Update My Profile" : "Edit User";
  const pageSubtitle = isMyProfile
    ? "Update your personal details below"
    : "Update user details below";

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl py-6">
        <Card className="">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <FormSkeleton />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!user) {
    return <ErrorMessage error="User not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title={pageTitle}
        description={pageSubtitle}
        backHref="/dashboard/users"
        backLabel="Back to Users"
      />

      <UserForm mode="edit" user={user} />
    </div>
  );
}
