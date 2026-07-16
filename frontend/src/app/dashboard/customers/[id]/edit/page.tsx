// src/app/dashboard/customers/[id]/edit/page.tsx
"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetCustomerQuery } from "@/redux/customerApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import CustomerForm from "@/components/customers/CustomerForm";
import FormSkeleton from "@/components/ui/FormSkeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { isStaff } from "@/utils/roles";

export default function EditCustomerPage() {
  const params = useParams<{ id: string }>();
  const customerId = parseInt(params.id, 10);

  const currentUser = useSelector((state: RootState) => state.auth.user);
  // Customers can only reach their own record; staff can edit anyone's.
  const isOwnProfile = !isStaff(currentUser) && currentUser?.id === customerId;

  const {
    data: customerData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetCustomerQuery(
    { customerId },
    { skip: !Number.isFinite(customerId) }
  );

  const customer = customerData?.data;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl py-6">
        <Card>
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

  if (isError) {
    return (
      <ErrorMessage
        error={extractApiErrorMessage(error).message}
        onRetry={refetch}
      />
    );
  }

  if (!customer) {
    return <ErrorMessage error="Customer not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title={isOwnProfile ? "Update My Profile" : "Edit Customer"}
        description={
          isOwnProfile
            ? "Update your personal details below"
            : "Update customer details below"
        }
        backHref={
          isOwnProfile
            ? `/dashboard/customers/${customerId}`
            : "/dashboard/customers"
        }
        backLabel={isOwnProfile ? "Back to Profile" : "Back to Customers"}
      />

      <CustomerForm mode="edit" customer={customer} />
    </div>
  );
}
