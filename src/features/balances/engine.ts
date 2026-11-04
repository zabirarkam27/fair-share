import { MAX_EXPENSE_POISHA } from "@/features/expenses/money";

export class BalanceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalanceInvariantError";
  }
}
export type LedgerExpense = {
  id: string;
  groupId: string;
  paidById: string;
  amountPoisha: bigint;
  splits: readonly { memberId: string; amountPoisha: bigint }[];
};
export type LedgerSettlement = {
  id: string;
  groupId: string;
  fromId: string;
  toId: string;
  amountPoisha: bigint;
};
export type LedgerInput = {
  groupId: string;
  memberIds: readonly string[];
  expenses: readonly LedgerExpense[];
  settlements: readonly LedgerSettlement[];
};
type Totals = {
  memberId: string;
  paidPoisha: bigint;
  allocatedPoisha: bigint;
  sentPoisha: bigint;
  receivedPoisha: bigint;
  netPoisha: bigint;
};
function validId(id: string) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw new BalanceInvariantError("Invalid ledger identifier.");
}
function amount(value: bigint) {
  if (typeof value !== "bigint" || value < 1n || value > MAX_EXPENSE_POISHA)
    throw new BalanceInvariantError("Invalid persisted monetary amount.");
}
function unique(ids: readonly string[]) {
  ids.forEach(validId);
  if (new Set(ids).size !== ids.length)
    throw new BalanceInvariantError("Duplicate ledger record or member.");
}
// Pure accounting only. Callers collect authoritative records in one snapshot.
// No split recalculation: persisted allocations are the source of truth.
export function calculateBalances(input: LedgerInput) {
  validId(input.groupId);
  unique(input.memberIds);
  unique(input.expenses.map((e) => e.id));
  unique(input.settlements.map((s) => s.id));
  const totals = new Map<string, Totals>(
    [...input.memberIds].sort().map((memberId) => [
      memberId,
      {
        memberId,
        paidPoisha: 0n,
        allocatedPoisha: 0n,
        sentPoisha: 0n,
        receivedPoisha: 0n,
        netPoisha: 0n,
      },
    ]),
  );
  function member(id: string) {
    const row = totals.get(id);
    if (!row)
      throw new BalanceInvariantError(
        "Financial record references a member outside the group.",
      );
    return row;
  }
  function group(groupId: string) {
    if (groupId !== input.groupId)
      throw new BalanceInvariantError(
        "Financial record belongs to another group.",
      );
  }
  let totalExpensePoisha = 0n,
    totalSettlementPoisha = 0n;
  const expenses = input.expenses.map((e) => {
    group(e.groupId);
    amount(e.amountPoisha);
    member(e.paidById);
    if (!e.splits.length)
      throw new BalanceInvariantError("Expense has no saved allocations.");
    unique(e.splits.map((s) => s.memberId));
    let allocated = 0n;
    for (const split of e.splits) {
      member(split.memberId);
      if (typeof split.amountPoisha !== "bigint" || split.amountPoisha < 0n)
        throw new BalanceInvariantError("Invalid persisted allocation.");
      allocated += split.amountPoisha;
    }
    if (allocated !== e.amountPoisha)
      throw new BalanceInvariantError(
        "Expense allocations do not equal the original amount.",
      );
    const allocations = new Map(
      e.splits.map((s) => [s.memberId, s.amountPoisha]),
    );
    const ids = [...new Set([e.paidById, ...allocations.keys()])].sort();
    const contributions = ids.map((memberId) => {
      const paidPoisha = e.paidById === memberId ? e.amountPoisha : 0n;
      const allocatedPoisha = allocations.get(memberId) ?? 0n;
      const netPoisha = paidPoisha - allocatedPoisha;
      const row = member(memberId);
      row.paidPoisha += paidPoisha;
      row.allocatedPoisha += allocatedPoisha;
      row.netPoisha += netPoisha;
      return { memberId, paidPoisha, allocatedPoisha, netPoisha };
    });
    if (contributions.reduce((sum, c) => sum + c.netPoisha, 0n) !== 0n)
      throw new BalanceInvariantError(
        "Expense contributions do not sum to zero.",
      );
    totalExpensePoisha += e.amountPoisha;
    return { expenseId: e.id, amountPoisha: e.amountPoisha, contributions };
  });
  const settlements = input.settlements.map((s) => {
    group(s.groupId);
    amount(s.amountPoisha);
    if (s.fromId === s.toId)
      throw new BalanceInvariantError(
        "A settlement cannot pay the same member.",
      );
    const sender = member(s.fromId),
      receiver = member(s.toId);
    sender.sentPoisha += s.amountPoisha;
    sender.netPoisha += s.amountPoisha;
    receiver.receivedPoisha += s.amountPoisha;
    receiver.netPoisha -= s.amountPoisha;
    totalSettlementPoisha += s.amountPoisha;
    return {
      settlementId: s.id,
      amountPoisha: s.amountPoisha,
      contributions: [
        { memberId: s.fromId, netPoisha: s.amountPoisha },
        { memberId: s.toId, netPoisha: -s.amountPoisha },
      ],
    };
  });
  const members = [...totals.values()];
  const groupTotalPoisha = members.reduce((sum, m) => sum + m.netPoisha, 0n);
  if (groupTotalPoisha !== 0n)
    throw new BalanceInvariantError("Group balances do not sum to zero.");
  return {
    members,
    expenses,
    settlements,
    totalExpensePoisha,
    totalSettlementPoisha,
    groupTotalPoisha,
    zeroSumVerified: true as const,
  };
}
export type CalculatedBalances = ReturnType<typeof calculateBalances>;
export function currentUserBalance(
  result: CalculatedBalances,
  memberId: string,
) {
  const row = result.members.find((m) => m.memberId === memberId);
  if (!row)
    throw new BalanceInvariantError(
      "Current member is absent from the ledger.",
    );
  return {
    netPoisha: row.netPoisha,
    owedByPoisha: row.netPoisha < 0n ? -row.netPoisha : 0n,
    owedToPoisha: row.netPoisha > 0n ? row.netPoisha : 0n,
  };
}
