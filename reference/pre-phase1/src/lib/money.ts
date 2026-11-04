export type Allocation = { userId: string; amount: number };
export type SplitType = "equal" | "exact" | "percentage" | "shares";
export const MAX_MONEY = 100_000_000; // BDT 1,000,000 per expense; bounded below int32.
export function decimalUnits(value: string, max = MAX_MONEY): number {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value))
    throw new Error(
      "Use a non-negative number with at most two decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  const units = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(units) || units > max)
    throw new Error("Amount is too large.");
  return units;
}
export function splitMoney(
  total: number,
  type: SplitType,
  inputs: { userId: string; value: string }[],
  seed: string,
): Allocation[] {
  if (!Number.isInteger(total) || total <= 0 || total > MAX_MONEY)
    throw new Error("Amount must be between ৳0.01 and ৳1,000,000.");
  if (
    !inputs.length ||
    inputs.length > 100 ||
    new Set(inputs.map((i) => i.userId)).size !== inputs.length
  )
    throw new Error("Select 1–100 distinct participants.");
  const sorted = [...inputs].sort((a, b) => a.userId.localeCompare(b.userId));
  if (type === "exact") {
    const result = sorted.map((i) => ({
      userId: i.userId,
      amount: decimalUnits(i.value),
    }));
    if (result.reduce((s, i) => s + i.amount, 0) !== total)
      throw new Error("Exact amounts must add up to the expense total.");
    return result;
  }
  if (!["equal", "percentage", "shares"].includes(type))
    throw new Error("Invalid split type.");
  const weights = sorted.map((i) =>
    type === "equal" ? 100 : decimalUnits(i.value, 1_000_000),
  );
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0 || (type === "shares" && weights.some((w) => w <= 0)))
    throw new Error("Shares must be positive.");
  if (type === "percentage" && sum !== 10000)
    throw new Error("Percentages must add up to 100%.");
  const denominator = BigInt(sum);
  const amounts = weights.map((w) =>
    Number((BigInt(total) * BigInt(w)) / denominator),
  );
  let hash = 0;
  for (const ch of seed) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  const offset = hash % sorted.length;
  const order = weights
    .map((w, i) => ({
      i,
      remainder: (BigInt(total) * BigInt(w)) % denominator,
      tie: (i - offset + sorted.length) % sorted.length,
    }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.tie - b.tie
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  const leftover = total - amounts.reduce((s, v) => s + v, 0);
  for (let n = 0; n < leftover; n++) amounts[order[n].i]++;
  return sorted.map((i, n) => ({ userId: i.userId, amount: amounts[n] }));
}
export type LedgerExpense = {
  paidBy: string;
  amount: number;
  allocations: Allocation[];
};
export type LedgerSettlement = { fromId: string; toId: string; amount: number };
export function balances(
  ids: string[],
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[],
) {
  const net: Record<string, number> = Object.fromEntries(
    ids.map((id) => [id, 0]),
  );
  const add = (id: string, n: number) => {
    if (!(id in net)) throw new Error("Ledger references an unknown member.");
    net[id] += n;
    if (!Number.isSafeInteger(net[id]))
      throw new Error("Ledger exceeds safe integer range.");
  };
  for (const e of expenses) {
    if (e.allocations.reduce((s, a) => s + a.amount, 0) !== e.amount)
      throw new Error("Unbalanced expense.");
    add(e.paidBy, e.amount);
    for (const a of e.allocations) add(a.userId, -a.amount);
  }
  for (const s of settlements) {
    add(s.fromId, s.amount);
    add(s.toId, -s.amount);
  }
  if (Object.values(net).reduce((s, n) => s + n, 0) !== 0)
    throw new Error("Ledger does not balance.");
  return net;
}
export type Payment = { fromId: string; toId: string; amount: number };
// Largest debtor/creditor first: at most n-1 payments, not a global minimum guarantee.
export function suggestPayments(net: Record<string, number>): Payment[] {
  if (
    Object.values(net).some((n) => !Number.isSafeInteger(n)) ||
    Object.values(net).reduce((s, n) => s + n, 0) !== 0
  )
    throw new Error("Invalid balances.");
  const debt = Object.entries(net)
    .filter(([, n]) => n < 0)
    .map(([id, n]) => ({ id, n: -n }));
  const credit = Object.entries(net)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, n }));
  const result: Payment[] = [];
  while (debt.length && credit.length) {
    debt.sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
    credit.sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
    const d = debt[0],
      c = credit[0],
      amount = Math.min(d.n, c.n);
    result.push({ fromId: d.id, toId: c.id, amount });
    d.n -= amount;
    c.n -= amount;
    if (!d.n) debt.shift();
    if (!c.n) credit.shift();
  }
  return result;
}
export function money(n: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  }).format(n / 100);
}
