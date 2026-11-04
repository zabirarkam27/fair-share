import { z } from "zod";
export const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date");
export const expenseSchema = z
  .object({
    description: z.string().trim().min(1).max(160),
    amount: z.string().max(20),
    date: dateSchema,
    paidBy: idSchema,
    splitType: z.enum(["equal", "exact", "percentage", "shares"]),
    inputs: z
      .array(z.object({ userId: idSchema, value: z.string().max(20) }).strict())
      .min(1)
      .max(100),
    version: z.number().int().positive().optional(),
  })
  .strict();
export const groupSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(240).default(""),
  })
  .strict();
export const settlementSchema = z
  .object({
    fromId: idSchema,
    toId: idSchema,
    amount: z.string().max(20),
    method: z.enum(["bKash", "Cash", "Bank"]),
    requestId: z.uuid(),
  })
  .strict();
