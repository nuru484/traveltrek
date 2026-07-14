// src/app/dashboard/users/[id]/edit-profile/page.tsx
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";
import { useGetUserQuery } from "@/redux/userApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import UserForm from "@/components/users/UserForm";
import FormSkeleton from "@/components/ui/FormSkeleton";

export default function EditUserPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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

  const handleGoBack = () => {
    router.push("/dashboard/users");
  };

  // ✅ Dynamic title based on search params
  const isMyProfile = Boolean(searchUserId);
  const pageTitle = isMyProfile ? "Update My Profile" : "Edit User";
  const pageSubtitle = isMyProfile
    ? "Update your personal details below"
    : "Update user details below";

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
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
    <div className="container mx-auto space-y-10">
      <div className="border-b border-border pb-4 sm:pb-6">
        {/* Mobile Layout */}
        <div className="flex flex-col space-y-3 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoBack}
            className="flex items-center gap-2 self-start"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground mt-1">{pageSubtitle}</p>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {pageTitle}
              </h1>
              <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGoBack}
            className="flex items-center gap-2 shrink-0 ml-4 hover:cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Users</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>
      </div>

      <UserForm mode="edit" user={user} />
    </div>
  );
}
