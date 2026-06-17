export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style:                 "currency",
    currency:              "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatChange(change: number, pct: number): string {
  const arrow = change >= 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(change).toFixed(2)} (${Math.abs(pct).toFixed(2)}%)`;
}

export function formatVolume(vol: number): string {
  if (vol >= 1_00_00_000) return `${(vol / 1_00_00_000).toFixed(2)} Cr`;
  if (vol >= 1_00_000)    return `${(vol / 1_00_000).toFixed(2)} L`;
  return vol.toLocaleString("en-IN");
}

export function formatLakhCrore(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000)    return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return formatINR(amount);
}
