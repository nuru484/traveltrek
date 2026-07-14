// src/app/dashboard/flights/create/page.tsx
"use client";

import { FlightForm } from "@/components/flights/flight-form";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function CreateFlightPage() {


  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Create Flight"
        description="Add a new flight"
        backHref="/dashboard/flights"
        backLabel="Back to Flights"
      />

      <FlightForm mode="create" />
    </div>
  );
}
