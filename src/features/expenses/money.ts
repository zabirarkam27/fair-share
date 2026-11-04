// Pure money boundary: strings at transport, bigint poisha in calculations.
export const MAX_EXPENSE_POISHA = 100_000_000n;
export class MoneyError extends Error {}
export function parsePoisha(value: string): bigint {
  if (typeof value !== "string" || !/^\d{1,7}(?:\.\d{1,2})?$/.test(value))
    throw new MoneyError(
      "Use a non-negative BDT amount with at most two decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (result > MAX_EXPENSE_POISHA)
    throw new MoneyError("The maximum amount is ৳1,000,000.00.");
  return result;
}
export function parseBasisPoints(value: string): number {
  if (typeof value !== "string" || !/^\d{1,3}(?:\.\d{1,2})?$/.test(value))
    throw new MoneyError("Use percentages with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const points = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (points > 10000) throw new MoneyError("A percentage cannot exceed 100%.");
  return points;
}
export function parseWeight(value: string): bigint {
  if (typeof value !== "string" || !/^\d{1,7}$/.test(value))
    throw new MoneyError("Shares must be positive integer weights.");
  const weight = BigInt(value);
  if (weight < 1n || weight > 1_000_000n)
    throw new MoneyError("Share weights must be between 1 and 1,000,000.");
  return weight;
}
export function poishaToDecimal(amount: bigint): string {
  if (typeof amount !== "bigint")
    throw new MoneyError("Expected integer poisha.");
  const sign = amount < 0n ? "-" : "";
  const abs = amount < 0n ? -amount : amount;
  return (
    sign +
    (abs / 100n).toString() +
    "." +
    (abs % 100n).toString().padStart(2, "0")
  );
}
export function formatPoisha(value: bigint | string): string {
  if (typeof value === "string" && !/^-?\d+$/.test(value))
    throw new MoneyError("Invalid poisha value.");
  const amount = typeof value === "bigint" ? value : BigInt(value);
  const sign = amount < 0n ? "-" : "";
  const abs = amount < 0n ? -amount : amount;
  return (
    sign +
    "৳" +
    new Intl.NumberFormat("en-BD").format(abs / 100n) +
    "." +
    (abs % 100n).toString().padStart(2, "0")
  );
}
