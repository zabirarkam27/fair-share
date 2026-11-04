import { MAX_EXPENSE_POISHA, MoneyError } from "./money";
export type Allocation = { memberId: string; amount: bigint };
export type ExactInput = { memberId: string; amount: bigint };
export type PercentageInput = { memberId: string; basisPoints: number };
export type ShareInput = { memberId: string; weight: bigint };
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
export function validateMembers(ids: readonly string[]): string[] {
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 100 ||
    ids.some((id) => typeof id !== "string" || !idPattern.test(id)) ||
    new Set(ids).size !== ids.length
  )
    throw new MoneyError("Select 1–100 distinct valid participants.");
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
function validateTotal(total: bigint) {
  if (typeof total !== "bigint" || total < 1n || total > MAX_EXPENSE_POISHA)
    throw new MoneyError("Expense must be between ৳0.01 and ৳1,000,000.00.");
}
function assertKeys(ids: string[], inputs: readonly { memberId: string }[]) {
  if (!Array.isArray(inputs))
    throw new MoneyError("Every participant needs a split value.");
  const actual = validateMembers(inputs.map((input) => input?.memberId));
  if (ids.length !== actual.length || ids.some((id, i) => id !== actual[i]))
    throw new MoneyError(
      "Every included participant must have exactly one split value.",
    );
}
function finish(total: bigint, result: Allocation[]) {
  if (
    result.some((a) => a.amount < 0n) ||
    result.reduce((sum, a) => sum + a.amount, 0n) !== total
  )
    throw new MoneyError("The split does not conserve the expense total.");
  return result;
}
function weighted(
  total: bigint,
  ids: string[],
  weights: bigint[],
  seed: string,
): Allocation[] {
  if (typeof seed !== "string" || !idPattern.test(seed))
    throw new MoneyError("A stable expense seed is required.");
  const denominator = weights.reduce((sum, n) => sum + n, 0n);
  if (denominator <= 0n)
    throw new MoneyError("The total weight must be positive.");
  const amounts = weights.map((w) => (total * w) / denominator);
  // Stable arithmetic over the seed; no random state or locale-sensitive sorting.
  let hash = 0n;
  for (const character of seed)
    hash = (hash * 31n + BigInt(character.charCodeAt(0))) % 4_294_967_291n;
  const offset = Number(hash % BigInt(ids.length));
  const order = weights
    .map((weight, i) => ({
      i,
      remainder: (total * weight) % denominator,
      rank: (i - offset + ids.length) % ids.length,
    }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.rank - b.rank
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  const remainder = total - amounts.reduce((sum, n) => sum + n, 0n);
  // Largest-remainder floors leave fewer than n poisha, so this conversion is bounded.
  for (let i = 0; i < Number(remainder); i++) amounts[order[i].i] += 1n;
  return finish(
    total,
    ids.map((memberId, i) => ({ memberId, amount: amounts[i] })),
  );
}
export function equalSplit(
  total: bigint,
  members: readonly string[],
  seed: string,
): Allocation[] {
  validateTotal(total);
  const ids = validateMembers(members);
  return weighted(
    total,
    ids,
    ids.map(() => 1n),
    seed,
  );
}
export function exactSplit(
  total: bigint,
  members: readonly string[],
  inputs: readonly ExactInput[],
): Allocation[] {
  validateTotal(total);
  const ids = validateMembers(members);
  assertKeys(ids, inputs);
  const values = new Map(inputs.map((i) => [i.memberId, i.amount]));
  const result = ids.map((memberId) => {
    const amount = values.get(memberId);
    if (
      typeof amount !== "bigint" ||
      amount < 0n ||
      amount > MAX_EXPENSE_POISHA
    )
      throw new MoneyError("Exact shares must be non-negative integer poisha.");
    return { memberId, amount };
  });
  if (result.reduce((sum, a) => sum + a.amount, 0n) !== total)
    throw new MoneyError("Exact shares must add up to the expense amount.");
  return finish(total, result);
}
export function percentageSplit(
  total: bigint,
  members: readonly string[],
  inputs: readonly PercentageInput[],
  seed: string,
): Allocation[] {
  validateTotal(total);
  const ids = validateMembers(members);
  assertKeys(ids, inputs);
  if (
    inputs.some(
      (i) =>
        !Number.isSafeInteger(i.basisPoints) ||
        i.basisPoints < 0 ||
        i.basisPoints > 10000,
    ) ||
    inputs.reduce((sum, i) => sum + i.basisPoints, 0) !== 10000
  )
    throw new MoneyError(
      "Percentages must be integer basis points adding up to exactly 100%.",
    );
  const values = new Map(
    inputs.map((i) => [i.memberId, BigInt(i.basisPoints)]),
  );
  return weighted(
    total,
    ids,
    ids.map((id) => values.get(id)!),
    seed,
  );
}
export function sharesSplit(
  total: bigint,
  members: readonly string[],
  inputs: readonly ShareInput[],
  seed: string,
): Allocation[] {
  validateTotal(total);
  const ids = validateMembers(members);
  assertKeys(ids, inputs);
  if (
    inputs.some(
      (i) =>
        typeof i.weight !== "bigint" || i.weight < 1n || i.weight > 1_000_000n,
    )
  )
    throw new MoneyError(
      "Share weights must be positive integers up to 1,000,000.",
    );
  const values = new Map(inputs.map((i) => [i.memberId, i.weight]));
  return weighted(
    total,
    ids,
    ids.map((id) => values.get(id)!),
    seed,
  );
}
