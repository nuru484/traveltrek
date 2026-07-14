// src/app/dashboard/users/create/page.tsx
"use client";

import UserForm from "@/components/users/UserForm";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function CreateUserPage() {


  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Create User"
        description="Add a new user"
        backHref="/dashboard/users"
        backLabel="Back to Users"
      />

      <UserForm mode="create" />
    </div>
  );
}
