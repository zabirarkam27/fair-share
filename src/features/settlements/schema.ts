import { z } from "zod";
export const paymentMethods = {
  BKASH: "bKash",
  CASH: "Cash",
  BANK: "Bank",
} as const;
export const recordSettlementSchema = z
  .object({
    groupId: z.uuid(),
    fromId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    toId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    amount: z.string().min(1).max(16),
    method: z.enum(["BKASH", "CASH", "BANK"]),
    requestKey: z.uuid(),
  })
  .strict();
export type RecordSettlementInput = z.infer<typeof recordSettlementSchema>;
