// src/app/dashboard/customers/[id]/page.tsx
"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import CustomerProfileHeader from "@/components/customers/CustomerProfileHeader";
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
import { isAdmin as isAdminUser } from "@/utils/roles";

const CustomerDetailPage = () => {
  const params = useParams<{ id: string }>();
  const customerId = parseInt(params.id, 10);
  const router = useRouter();

  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isAdmin = isAdminUser(currentUser);

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 py-6">
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="outline" size="sm" className="cursor-pointer">
          <Link href={`/dashboard/customers/${customerId}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Customer
          </Link>
        </Button>
        {isAdmin && (
          <Button
            variant="destructive"
            size="sm"
            className="cursor-pointer"
            disabled={isDeleting}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Customer
          </Button>
        )}
      </div>

      <CustomerProfileHeader customer={customer} />

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
