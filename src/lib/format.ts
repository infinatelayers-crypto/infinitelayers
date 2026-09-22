export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "").slice(-10);
}
