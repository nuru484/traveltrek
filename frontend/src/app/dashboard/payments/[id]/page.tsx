// src/app/dashboard/payments/[id]/page.tsx
"use client";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams } from "next/navigation";
import { useGetPaymentQuery } from "@/redux/paymentApi";
import PaymentDetailView from "@/components/payments/PaymentDetailView";
import PaymentDetailViewSkeleton from "@/components/payments/PaymentDetailViewSkeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

const PaymentDetailPage = () => {
  const params = useParams<{ id: string }>();
  const paymentId = parseInt(params.id, 10);

  const {
    data: paymentData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetPaymentQuery(paymentId);

  const payment = paymentData?.data;
  const errorMessage = extractApiErrorMessage(error).message;


  if (isLoading) return <PaymentDetailViewSkeleton />;

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!payment) {
    return <ErrorMessage error="Payment not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Responsive Page Header */}
      <DetailPageHeader
        title="Payment details"
        description="View payment information and transaction details"
        backHref="/dashboard/payments"
        backLabel="Back to payments"
      />

      {/* Payment Detail Component */}
      <PaymentDetailView payment={payment} />
    </div>
  );
};

export default PaymentDetailPage;
