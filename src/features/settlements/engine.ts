import { MAX_EXPENSE_POISHA } from "@/features/expenses/money";
export const EXACT_MEMBER_LIMIT = 10;
export const MAX_PLAN_PAYMENTS = 1000;
export type NetBalance = { memberId: string; netPoisha: bigint };
export type SuggestedPayment = {
  fromId: string;
  toId: string;
  amountPoisha: bigint;
};
export class SettlementPlanError extends Error {}
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
function validated(balances: readonly NetBalance[]) {
  if (
    balances.some(
      (b) =>
        typeof b.memberId !== "string" ||
        !idPattern.test(b.memberId) ||
        typeof b.netPoisha !== "bigint",
    ) ||
    new Set(balances.map((b) => b.memberId)).size !== balances.length
  )
    throw new SettlementPlanError("Invalid or duplicate balance members.");
  if (balances.reduce((sum, b) => sum + b.netPoisha, 0n) !== 0n)
    throw new SettlementPlanError("Group balances must sum to zero.");
  return [...balances]
    .filter((b) => b.netPoisha !== 0n)
    .sort((a, b) =>
      a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0,
    );
}
function greedy(balances: readonly NetBalance[]): SuggestedPayment[] {
  const debtors = balances
    .filter((b) => b.netPoisha < 0n)
    .map((b) => ({ id: b.memberId, remaining: -b.netPoisha }));
  const creditors = balances
    .filter((b) => b.netPoisha > 0n)
    .map((b) => ({ id: b.memberId, remaining: b.netPoisha }));
  const order = (a: (typeof debtors)[number], b: (typeof debtors)[number]) =>
    a.remaining === b.remaining
      ? a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0
      : a.remaining > b.remaining
        ? -1
        : 1;
  const payments: SuggestedPayment[] = [];
  while (debtors.length && creditors.length) {
    if (payments.length >= MAX_PLAN_PAYMENTS)
      throw new SettlementPlanError(
        "This ledger needs too many payments to display safely.",
      );
    debtors.sort(order);
    creditors.sort(order);
    const debtor = debtors[0],
      creditor = creditors[0];
    const outstanding =
      debtor.remaining < creditor.remaining
        ? debtor.remaining
        : creditor.remaining;
    const amountPoisha =
      outstanding < MAX_EXPENSE_POISHA ? outstanding : MAX_EXPENSE_POISHA;
    payments.push({ fromId: debtor.id, toId: creditor.id, amountPoisha });
    debtor.remaining -= amountPoisha;
    creditor.remaining -= amountPoisha;
    if (debtor.remaining === 0n) debtors.shift();
    if (creditor.remaining === 0n) creditors.shift();
  }
  return payments;
}
// Exact maximum zero-sum partition DP: minimum transfers = n - partitions.
// Only nonzero members enter masks; n <= 10 bounds enumeration by O(3^n).
function exact(balances: readonly NetBalance[]) {
  const size = 1 << balances.length,
    sums = Array<bigint>(size).fill(0n);
  for (let mask = 1; mask < size; mask++) {
    const bit = mask & -mask;
    const index = 31 - Math.clz32(bit);
    sums[mask] = sums[mask ^ bit] + balances[index].netPoisha;
  }
  const counts = new Int16Array(size).fill(-1),
    choice = new Uint16Array(size);
  counts[0] = 0;
  function solve(mask: number): number {
    if (counts[mask] >= 0) return counts[mask];
    const anchor = mask & -mask;
    for (let subset = mask; subset; subset = (subset - 1) & mask) {
      if (subset & anchor && sums[subset] === 0n) {
        const count = 1 + solve(mask ^ subset);
        if (count > counts[mask]) {
          counts[mask] = count;
          choice[mask] = subset;
        }
      }
    }
    return counts[mask];
  }
  solve(size - 1);
  const payments: SuggestedPayment[] = [];
  for (let mask = size - 1; mask;) {
    const subset = choice[mask];
    if (!subset)
      throw new SettlementPlanError(
        "Exact payment partition could not be reconstructed.",
      );
    payments.push(
      ...greedy(balances.filter((_, index) => (subset & (1 << index)) !== 0)),
    );
    mask ^= subset;
  }
  return payments;
}
export function verifySuggestedPayments(
  balances: readonly NetBalance[],
  payments: readonly SuggestedPayment[],
) {
  validated(balances);
  const remaining = new Map(balances.map((b) => [b.memberId, b.netPoisha]));
  for (const payment of payments) {
    const debtor = remaining.get(payment.fromId),
      creditor = remaining.get(payment.toId);
    if (
      payment.fromId === payment.toId ||
      typeof payment.amountPoisha !== "bigint" ||
      payment.amountPoisha <= 0n ||
      payment.amountPoisha > MAX_EXPENSE_POISHA ||
      debtor === undefined ||
      creditor === undefined ||
      debtor >= 0n ||
      creditor <= 0n ||
      payment.amountPoisha > -debtor ||
      payment.amountPoisha > creditor
    )
      throw new SettlementPlanError(
        "Suggested payment exceeds a valid outstanding obligation.",
      );
    remaining.set(payment.fromId, debtor + payment.amountPoisha);
    remaining.set(payment.toId, creditor - payment.amountPoisha);
  }
  if ([...remaining.values()].some((value) => value !== 0n))
    throw new SettlementPlanError(
      "Suggested payments do not clear the balances.",
    );
  return true as const;
}
export function suggestPayments(
  balances: readonly NetBalance[],
  strategy: "AUTO" | "GREEDY" = "AUTO",
) {
  const members = validated(balances);
  const withinLimit = members.every(
    (b) =>
      b.netPoisha >= -MAX_EXPENSE_POISHA && b.netPoisha <= MAX_EXPENSE_POISHA,
  );
  const minimumGuaranteed =
    strategy === "AUTO" && members.length <= EXACT_MEMBER_LIMIT && withinLimit;
  const payments = minimumGuaranteed ? exact(members) : greedy(members);
  verifySuggestedPayments(balances, payments);
  return {
    payments,
    algorithm: minimumGuaranteed ? ("EXACT" as const) : ("GREEDY" as const),
    minimumGuaranteed,
    nonzeroMemberCount: members.length,
    clearsBalances: true as const,
  };
}
