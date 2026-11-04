import { z } from "zod";
const memberId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const expenseDataSchema = z
  .object({
    groupId: z.uuid(),
    description: z.string().trim().min(1).max(160),
    amount: z.string().max(16),
    date: z.iso.date(),
    paidById: memberId,
    splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"]),
    participants: z
      .array(z.object({ memberId, value: z.string().max(16) }).strict())
      .min(1)
      .max(100),
  })
  .strict();
export const createExpenseSchema = expenseDataSchema
  .extend({ requestKey: z.uuid() })
  .strict();
export const editExpenseSchema = expenseDataSchema
  .extend({ expenseId: z.uuid(), version: z.number().int().positive() })
  .strict();
export const previewExpenseSchema = expenseDataSchema
  .extend({
    seed: z.uuid(),
    expenseId: z.uuid().optional(),
    version: z.number().int().positive().optional(),
  })
  .strict()
  .refine((data) => !!data.expenseId === (data.version !== undefined), {
    message: "Editing a preview requires an expense and its version.",
  });
export const expenseKeySchema = z
  .object({ groupId: z.uuid(), expenseId: z.uuid() })
  .strict();
export const deleteExpenseSchema = expenseKeySchema
  .extend({ version: z.number().int().positive() })
  .strict();
export const listExpenseSchema = z
  .object({
    groupId: z.uuid(),
    page: z.number().int().min(1).max(100000).default(1),
  })
  .strict();
export type ExpenseData = z.infer<typeof expenseDataSchema>;
