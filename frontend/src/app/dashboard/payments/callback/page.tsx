// src/app/dashboard/payments/callback/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePaymentCallbackQuery } from "@/redux/paymentApi";
import toast from "react-hot-toast";

type PaymentStatus = "loading" | "success" | "failed" | "error";

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>("loading");

  const reference = searchParams.get("reference") || searchParams.get("trxref");

  const {
    data: result,
    error,
    isLoading,
    refetch,
  } = usePaymentCallbackQuery(reference || "", {
    skip: !reference,
  });

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      toast.error("No payment reference found");
      return;
    }

    if (result?.success) {
      setStatus("success");
      toast.success("Payment verified successfully!");
    } else if (error) {
      setStatus("error");
      const err = error as { data?: { message?: string } };
      toast.error(err.data?.message || "Payment verification failed");
    } else if (result && !result.success) {
      setStatus("failed");
      toast.error("Payment verification failed");
    }
  }, [result, error, reference]);

  const handleContinue = () => {
    if (status === "success") {
      router.push(`/dashboard/bookings`);
    } else {
      router.push(`/dashboard/bookings`);
    }
  };

  const handleRetry = () => {
    if (reference) {
      setStatus("loading");
      refetch();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md border-border">
        <CardContent className="p-8 text-center space-y-6">
          {(status === "loading" || isLoading) && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                  <div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Verifying Payment
                </h2>
                <p className="text-muted-foreground text-sm">
                  Please wait while we verify your payment with Paystack...
                </p>
              </div>
            </div>
          )}

          {status === "success" && result?.data && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <CheckCircle className="h-16 w-16 text-primary" />
                  <div className="absolute inset-0 bg-primary/10 rounded-full" />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-foreground">
                  Payment Successful!
                </h2>
                <p className="text-muted-foreground text-sm">
                  Your booking has been confirmed successfully.
                </p>
              </div>

              <div className="bg-accent border border-border rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-accent-foreground">
                    Amount:
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    GHS {result.data.amount?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-accent-foreground">
                    Reference:
                  </span>
                  <span className="text-xs font-mono text-muted-foreground break-all">
                    {result.data.reference}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-accent-foreground">
                    Status:
                  </span>
                  <span className="text-sm capitalize text-primary font-medium">
                    {result.data.paymentStatus}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                You&apos;ll receive a confirmation email shortly.
              </p>

              <Button
                onClick={handleContinue}
                className="w-full hover:cursor-pointer"
              >
                View Booking Details
              </Button>
            </div>
          )}

          {status === "failed" && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <XCircle className="h-16 w-16 text-destructive" />
                  <div className="absolute inset-0 bg-destructive/10 rounded-full" />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-destructive">
                  Payment Failed
                </h2>
                <p className="text-muted-foreground text-sm">
                  Unfortunately, your payment could not be processed.
                </p>
              </div>

              {result?.data && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">
                      Reference:
                    </span>
                    <span className="text-xs font-mono text-muted-foreground break-all">
                      {result.data.reference}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">
                      Status:
                    </span>
                    <span className="text-sm capitalize text-destructive font-medium">
                      {result.data.paymentStatus}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="w-full hover:cursor-pointer"
                >
                  Retry Verification
                </Button>
                <Button
                  onClick={handleContinue}
                  variant="secondary"
                  className="w-full hover:cursor-pointer"
                >
                  Back to Bookings
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <AlertCircle className="h-16 w-16 text-chart-4" />
                  <div className="absolute inset-0 bg-chart-4/10 rounded-full" />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-chart-4">
                  Verification Error
                </h2>
                <p className="text-muted-foreground text-sm">
                  There was an error verifying your payment. This doesn&apos;t
                  necessarily mean your payment failed.
                </p>
              </div>

              <div className="bg-chart-4/5 border border-chart-4/20 rounded-lg p-4">
                <p className="text-sm text-foreground">
                  <strong>What to do next:</strong>
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                  <li>• Try verifying again in a moment</li>
                  <li>• Check your bookings to see if payment went through</li>
                  <li>• Contact support if the issue persists</li>
                </ul>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleRetry}
                  className="w-full hover:cursor-pointer"
                >
                  Try Again
                </Button>
                <Button
                  onClick={handleContinue}
                  variant="outline"
                  className="w-full hover:cursor-pointer"
                >
                  Check My Bookings
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
