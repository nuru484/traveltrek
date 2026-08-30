// src/app/dashboard/users/create/page.tsx
"use client";

import UserForm from "@/components/users/UserForm";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function CreateUserPage() {


  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Add staff"
        description="Add a new admin or agent account"
        backHref="/dashboard/users"
        backLabel="Back to staff"
      />

      <UserForm mode="create" />
    </div>
  );
}
