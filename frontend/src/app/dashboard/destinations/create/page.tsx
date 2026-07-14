// src/app/dashboard/destinations/create/page.tsx
"use client";

import DestinationForm from "@/components/destinations/DestinationForm";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function CreateDestinationPage() {


  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Create Destination"
        description="Add a new destination"
        backHref="/dashboard/destinations"
        backLabel="Back to Destinations"
      />

      <DestinationForm mode="create" />
    </div>
  );
}
