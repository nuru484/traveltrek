// src/app/dashboard/customers/[id]/page.tsx
//
// Customer profile: passenger-record header (identity, contact chips, signup
// method, role-gated actions), lifetime stats from the profile DTO, and the
// full booking/payment histories. Reached by staff for any customer and by a
// customer for their OWN record (the backend enforces self-vs-others).
"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import CustomerProfileHeader from "@/components/customers/CustomerProfileHeader";
import { CustomerStats } from "@/components/customers/CustomerStats";
import { CustomerBookings } from "@/components/customers/CustomerBookings";
import { CustomerPayments } from "@/components/customers/CustomerPayments";
import UserProfileHeaderSkeleton from "@/components/users/UserProfileHeaderSkeleton";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  useDeleteCustomerMutation,
  useGetCustomerQuery,
} from "@/redux/customerApi";
import { RootState } from "@/redux/store";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { isAdmin as isAdminUser, isStaff as isStaffUser } from "@/utils/roles";

const CustomerDetailPage = () => {
  const params = useParams<{ id: string }>();
  const customerId = parseInt(params.id, 10);
  const router = useRouter();

  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isAdmin = isAdminUser(currentUser);
  const isStaff = isStaffUser(currentUser);
  // A customer reaching this page can only be looking at their own record.
  const isOwnProfile = !isStaff && currentUser?.id === customerId;

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteCustomer, { isLoading: isDeleting }] =
    useDeleteCustomerMutation();

  const {
    data: customerData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetCustomerQuery({ customerId }, { skip: !Number.isFinite(customerId) });

  const handleDelete = async () => {
    const toastId = toast.loading("Deleting customer...");
    try {
      await deleteCustomer(customerId).unwrap();
      toast.dismiss(toastId);
      toast.success("Customer deleted successfully");
      router.push("/dashboard/customers");
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(extractApiErrorMessage(err).message);
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-8 py-6">
        <UserProfileHeaderSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-7xl py-6">
        <ErrorMessage
          error={extractApiErrorMessage(error).message}
          onRetry={refetch}
        />
      </div>
    );
  }

  const customer = customerData?.data ?? null;

  // Edit: staff or the customer themself (the backend PUT rule); delete: ADMIN.
  const actions =
    isStaff || isOwnProfile || isAdmin ? (
      <>
        {(isStaff || isOwnProfile) && (
          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <Link href={`/dashboard/customers/${customerId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
        {isAdmin && (
          <Button
            variant="destructive"
            size="sm"
            className="cursor-pointer"
            disabled={isDeleting}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 py-6">
      <CustomerProfileHeader customer={customer} actions={actions} />

      {customer && <CustomerStats stats={customer.stats} />}

      <div className="space-y-6">
        <CustomerBookings customerId={customerId} />
        <CustomerPayments customerId={customerId} />
      </div>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Customer"
        description={`Are you sure you want to delete "${
          customer?.name ?? "this customer"
        }"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
      />
    </div>
  );
};

export default CustomerDetailPage;
