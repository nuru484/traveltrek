// src/app/dashboard/hotels/create/page.tsx
"use client";

import { HotelForm } from "@/components/hotels/hotel-form";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function CreateHotelPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Create Hotel"
        description="Fill in details to add a new hotel"
        backHref="/dashboard/hotels"
        backLabel="Back to Hotels"
      />

      <HotelForm mode="create" />
    </div>
  );
}
