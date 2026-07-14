// src/components/ui/Money.tsx
import { formatMoney } from "@/utils/format-money";

/**
 * Money for constrained surfaces: renders the compact figure (₵24.5M) with
 * the exact amount in the native tooltip, so admins can always recover the
 * precise value on hover. Detail views show the exact figure in full.
 */
export function Money({
  amount,
  symbol = "₵",
  className,
}: {
  amount: number;
  symbol?: string;
  className?: string;
}) {
  const exact = `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return (
    <span className={className} title={exact}>
      {formatMoney(amount, symbol)}
    </span>
  );
}
