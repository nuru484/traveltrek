// src/utils/format-money.ts

/**
 * Money for constrained surfaces (cards, stat tiles, table cells): exact
 * with thousands separators up to six digits, compact beyond (₵24.5M) so a
 * worst-case amount can never break a layout. Detail views should show the
 * exact figure via toLocaleString instead.
 */
export function formatMoney(amount: number, currencySymbol = "₵"): string {
  if (!Number.isFinite(amount)) return `${currencySymbol}0`;
  if (Math.abs(amount) >= 1_000_000) {
    const compact = new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
    return `${currencySymbol}${compact}`;
  }
  return `${currencySymbol}${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}
