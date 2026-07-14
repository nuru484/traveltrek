// src/app/dashboard/tours/[id]/edit/page.tsx
"use client";

import { useGetTourQuery } from "@/redux/tourApi";
import { TourForm } from "@/components/tours/tour-form";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import FormSkeleton from "@/components/ui/FormSkeleton";

export default function EditTourPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tourId = parseInt(params.id, 10);

  const handleGoBack = () => {
    router.push("/dashboard/tours");
  };

  const {
    data: tourData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetTourQuery(tourId);

  const tour = tourData?.data;
  const errorMessage = extractApiErrorMessage(error).message;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-10">
        <div className="border-b border-border pb-4 sm:pb-6">
          <div className="flex flex-col space-y-3 sm:hidden">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="hidden sm:flex sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        </div>
        <FormSkeleton />
      </div>
    );
  }

  if (isError) {
    return <ErrorMessage error={errorMessage} onRetry={refetch} />;
  }

  if (!tour) {
    return <ErrorMessage error="Tour not found" onRetry={refetch} />;
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
            <h1 className="text-xl font-bold text-foreground">Edit Tour</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Update tour details
            </p>
          </div>
        </div>

        {/* Tablet/Desktop Layout */}
        <div className="hidden sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Pencil className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Edit Tour</h1>
              <p className="text-sm text-muted-foreground">
                Modify existing tour details
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoBack}
            className="flex items-center gap-2 shrink-0 ml-4 hover:cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Tours</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>
      </div>

      <TourForm mode="edit" tour={tour} />
    </div>
  );
}
