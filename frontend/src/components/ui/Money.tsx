// src/components/ui/Money.tsx
import { formatMoney } from "@/utils/format-money";

/**
 * Money for constrained surfaces. `amount` is integer minor units (pesewas),
 * as every API money field is. Renders the compact figure (GH₵ 24.5M) with
 * the exact amount in the native tooltip, so admins can always recover the
 * precise value on hover. Detail views show the exact figure in full.
 */
export function Money({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  return (
    <span className={className} title={formatMoney(amount, { exact: true })}>
      {formatMoney(amount)}
    </span>
  );
}
