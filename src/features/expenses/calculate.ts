import { type ExpenseData } from "./schema";
import {
  parsePoisha,
  parseBasisPoints,
  parseWeight,
  MoneyError,
} from "./money";
import {
  equalSplit,
  exactSplit,
  percentageSplit,
  sharesSplit,
} from "./split-engine";

// Shared preview/server calculation. Contextual membership checks remain server-only.
export function calculateExpense(data: ExpenseData, seed: string) {
  const total = parsePoisha(data.amount);
  const ids = data.participants.map((p) => p.memberId);
  let allocations;
  const inputs = new Map<string, bigint | null>();
  switch (data.splitType) {
    case "EQUAL":
      if (data.participants.some((p) => p.value !== ""))
        throw new MoneyError("Equal splits do not accept custom values.");
      allocations = equalSplit(total, ids, seed);
      break;
    case "EXACT":
      allocations = exactSplit(
        total,
        ids,
        data.participants.map((p) => {
          const amount = parsePoisha(p.value);
          inputs.set(p.memberId, amount);
          return { memberId: p.memberId, amount };
        }),
      );
      break;
    case "PERCENTAGE":
      allocations = percentageSplit(
        total,
        ids,
        data.participants.map((p) => {
          const basisPoints = parseBasisPoints(p.value);
          inputs.set(p.memberId, BigInt(basisPoints));
          return { memberId: p.memberId, basisPoints };
        }),
        seed,
      );
      break;
    case "SHARES":
      allocations = sharesSplit(
        total,
        ids,
        data.participants.map((p) => {
          const weight = parseWeight(p.value);
          inputs.set(p.memberId, weight);
          return { memberId: p.memberId, weight };
        }),
        seed,
      );
  }
  return {
    total,
    splits: allocations.map((a) => ({
      userId: a.memberId,
      amount: a.amount,
      inputUnits: inputs.get(a.memberId) ?? null,
    })),
  };
}
