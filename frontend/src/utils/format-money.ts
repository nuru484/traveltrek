// src/utils/format-money.ts

/**
 * The ONE money formatter. Takes integer minor units (pesewas — the unit
 * every API money field is expressed in: GH₵ 1.00 = 100) and renders GHS:
 * exact with thousands separators and two decimals up to GH₵ 999,999.99
 * ("GH₵ 1,234.50"), compact beyond ("GH₵ 24.5M") so a worst-case amount can
 * never break a constrained layout. Detail views wanting the full figure can
 * pass `{ exact: true }`.
 */
export function formatMoney(
  minorUnits: number,
  options: { exact?: boolean } = {},
): string {
  if (!Number.isFinite(minorUnits)) return "GH₵ 0.00";
  const cedis = minorUnits / 100;
  if (!options.exact && Math.abs(cedis) >= 1_000_000) {
    const compact = new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(cedis);
    return `GH₵ ${compact}`;
  }
  return `GH₵ ${cedis.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
