// src/app/dashboard/customers/create/page.tsx
"use client";

import CustomerForm from "@/components/customers/CustomerForm";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function CreateCustomerPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Create Customer"
        description="Add a new customer — a name plus an email or phone number is enough"
        backHref="/dashboard/customers"
        backLabel="Back to Customers"
      />

      <CustomerForm mode="create" redirectTo="/dashboard/customers" />
    </div>
  );
}
