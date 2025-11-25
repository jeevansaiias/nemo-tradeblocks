export function formatCompactPL(value: number): string {
  const abs = Math.abs(value);

  let divisor = 1;
  let suffix = '';

  if (abs >= 1_000_000_000) {
    divisor = 1_000_000_000;
    suffix = 'B';
  } else if (abs >= 1_000_000) {
    divisor = 1_000_000;
    suffix = 'M';
  } else if (abs >= 1_000) {
    divisor = 1_000;
    suffix = 'K';
  }

  const scaled = value / divisor;

  const formatted = scaled.toLocaleString('en-US', {
    minimumFractionDigits: scaled >= 100 || divisor === 1 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return `${value < 0 ? '-' : ''}${formatted}${suffix}`;
}
