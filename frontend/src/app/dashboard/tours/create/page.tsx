// src/app/dashboard/tours/create/page.tsx
"use client";

import { TourForm } from "@/components/tours/tour-form";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function CreateTourPage() {


  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Add tour"
        description="Add a new tour"
        backHref="/dashboard/tours"
        backLabel="Back to tours"
      />

      <TourForm mode="create" />
    </div>
  );
}
