// src/components/payments/table/PaymentActionsDropdown.tsx
"use client";
import * as React from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { IPayment } from "@/types/payment.types";
import {
  useUpdatePaymentStatusMutation,
  useDeletePaymentMutation,
  useRefundPaymentMutation,
} from "@/redux/paymentApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { formatMoney } from "@/utils/format-money";

interface PaymentActionsDropdownProps {
  payment: IPayment;
  userRole?: "ADMIN" | "AGENT" | "CUSTOMER";
}

export function PaymentActionsDropdown({
  payment,
  userRole = "CUSTOMER",
}: PaymentActionsDropdownProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = React.useState(false);

  const [updatePaymentStatus] = useUpdatePaymentStatusMutation();
  const [deletePayment] = useDeletePaymentMutation();
  const [refundPayment] = useRefundPaymentMutation();

  const handleDeletePayment = async () => {
    const toastId = toast.loading("Deleting payment...");

    try {
      await deletePayment(payment.id).unwrap();
      toast.dismiss(toastId);
      toast.success("Payment deleted successfully");
      setDeleteDialogOpen(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message);
      setDeleteDialogOpen(false);
    }
  };

  const handleStatusUpdate = async (newStatus: IPayment["status"]) => {
    const toastId = toast.loading("Updating payment status...");

    try {
      await updatePaymentStatus({
        paymentId: payment.id,
        data: { status: newStatus },
      }).unwrap();

      toast.dismiss(toastId);
      toast.success(`Payment status updated to ${newStatus}`);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message);
    }
  };

  const handleRefundPayment = async () => {
    const toastId = toast.loading("Processing refund...");

    try {
      await refundPayment({
        paymentId: payment.id,
        data: { reason: "Admin initiated refund" },
      }).unwrap();

      toast.dismiss(toastId);
      toast.success("Payment refunded successfully");
      setRefundDialogOpen(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message);
      setRefundDialogOpen(false);
    }
  };

  const getStatusIcon = (status: IPayment["status"]) => {
    switch (status) {
      case "PENDING":
        return <AlertCircle className="mr-2 h-4 w-4" />;
      case "COMPLETED":
        return <CheckCircle className="mr-2 h-4 w-4" />;
      case "FAILED":
        return <XCircle className="mr-2 h-4 w-4" />;
      case "REFUNDED":
      case "REFUND_REQUESTED":
        return <RefreshCw className="mr-2 h-4 w-4" />;
    }
  };

  const statusOptions: { value: IPayment["status"]; label: string }[] = [
    { value: "PENDING", label: "Pending" },
    { value: "COMPLETED", label: "Completed" },
    { value: "FAILED", label: "Failed" },
    { value: "REFUNDED", label: "Refunded" },
  ];

  // Check if payment can be deleted (only non-completed payments; a
  // REFUND_REQUESTED payment holds real money awaiting a refund).
  const canDelete =
    payment.status !== "COMPLETED" && payment.status !== "REFUND_REQUESTED";

  // Refund applies to COMPLETED payments and REFUND_REQUESTED ones (a
  // customer self-cancelled a paid booking) — mirrors the backend rule.
  const canRefund =
    payment.status === "COMPLETED" || payment.status === "REFUND_REQUESTED";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 hover:cursor-pointer">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* View Payment */}
          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/payments/${payment.id}`}
              className="hover:cursor-pointer"
            >
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>

          {/* Admin-only actions */}
          {userRole === "ADMIN" && (
            <>
              <DropdownMenuSeparator />

              {/* Update Status */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:cursor-pointer">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Update Status
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {statusOptions.map((status) => (
                    <DropdownMenuItem
                      key={status.value}
                      className="hover:cursor-pointer"
                      onClick={() => handleStatusUpdate(status.value)}
                      disabled={payment.status === status.value}
                    >
                      {getStatusIcon(status.value)}
                      {status.label}
                      {payment.status === status.value && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          Current
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Refund Payment - Only for completed payments */}
              {canRefund && (
                <DropdownMenuItem
                  className="text-orange-600 hover:cursor-pointer"
                  onClick={() => setRefundDialogOpen(true)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refund Payment
                </DropdownMenuItem>
              )}

              {/* Delete Payment - Only for non-completed payments */}
              {canDelete && (
                <DropdownMenuItem
                  className="text-red-600 hover:cursor-pointer"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Payment
                </DropdownMenuItem>
              )}

              {/* Show why actions are disabled */}
              {!canDelete && !canRefund && (
                <DropdownMenuItem
                  disabled
                  className="text-xs text-muted-foreground"
                >
                  No actions available for {payment.status.toLowerCase()}{" "}
                  payments
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Payment"
        description={`Are you sure you want to delete payment ${payment.transactionReference}? This action cannot be undone and will reset the booking status to pending.`}
        onConfirm={handleDeletePayment}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
      />

      {/* Refund Confirmation Dialog */}
      <ConfirmationDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        title="Refund Payment"
        description={`Are you sure you want to refund payment ${
          payment.transactionReference
        } for ${formatMoney(payment.amount, { exact: true })}? This will mark the payment as refunded and cancel the associated booking.`}
        onConfirm={handleRefundPayment}
        confirmText="Refund Payment"
        cancelText="Cancel"
        isDestructive={true}
        requireExactMatch="Refund Payment"
      />
    </>
  );
}
