// src/components/bookings/booking-price-summary.tsx
//
// Price breakdown box shared by BookingButton's two dialogs: per-guest price ×
// guest count = total.
"use client";
import { Money } from "@/components/ui/Money";

export function BookingPriceSummary({
  price,
  guestsCount,
  totalPrice,
  className }: {
  /** Integer minor units (pesewas). */
  price: number;
  guestsCount: number;
  /** Integer minor units (pesewas). */
  totalPrice: number;
  className: string;
}) {
  return (
    <div className={className}>
      <div className="space-y-2">
        <div className="flex justify-between items-start gap-2 text-sm">
          <span className="text-muted-foreground break-words flex-1">
            Base Price (per guest)
          </span>
          <span className="font-medium whitespace-nowrap">
            <Money amount={price} />
          </span>
        </div>
        <div className="flex justify-between items-start gap-2 text-sm">
          <span className="text-muted-foreground break-words flex-1">
            Number of Guests
          </span>
          <span className="font-medium whitespace-nowrap">
            × {guestsCount}
          </span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between items-start gap-2">
          <span className="text-sm font-medium text-muted-foreground break-words flex-1">
            Total Price
          </span>
          <span className="text-lg font-semibold text-foreground whitespace-nowrap">
            <Money amount={totalPrice} />
          </span>
        </div>
      </div>
    </div>
  );
}
