// src/components/bookings/booking-detail/PaymentDeadlineAlert.tsx
//
// The pending-booking payment deadline banner: neutral amber before the
// deadline, destructive once it has passed.
import React from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDate } from "./format";

export function PaymentDeadlineAlert({
  deadline,
  deadlinePassed,
}: {
  deadline: string;
  deadlinePassed: boolean;
}) {
  return (
    <Alert
      variant={deadlinePassed ? "destructive" : "default"}
      className={!deadlinePassed ? "border-amber-200 bg-amber-50" : ""}
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        {deadlinePassed ? (
          <span className="font-medium">
            Payment deadline has passed ({formatDate(deadline)})
          </span>
        ) : (
          <span>
            <span className="font-medium">Payment Due:</span>{" "}
            {formatDate(deadline)}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
