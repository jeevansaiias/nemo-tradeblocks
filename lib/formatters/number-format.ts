export function formatCompactCurrency(
  value: number | null | undefined,
  {
    currencySymbol = "$",
    maxFractionDigits = 2,
  }: { currencySymbol?: string; maxFractionDigits?: number } = {}
): string {
  if (value == null || Number.isNaN(value)) return "--";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  const formatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: maxFractionDigits,
  });

  return `${sign}${currencySymbol}${formatter.format(abs)}`;
}
