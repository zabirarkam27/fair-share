"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { GroupError } from "@/features/groups/service";
import { MoneyError } from "@/features/expenses/money";
import { BalanceInvariantError } from "@/features/balances/engine";
import { settlements } from "./server";
export async function recordSettlement(input: unknown) {
  try {
    const data = await settlements.record(input);
    revalidatePath("/dashboard", "layout");
    return { data };
  } catch (error) {
    if (error instanceof GroupError || error instanceof MoneyError)
      return { error: error.message };
    if (error instanceof ZodError)
      return { error: "Check the members, amount and payment method." };
    if (error instanceof BalanceInvariantError)
      return {
        error:
          "Saved group records do not reconcile. Review the expenses first.",
      };
    console.error(
      "Settlement recording failed",
      error instanceof Error ? error.name : "Unknown",
    );
    return {
      error: "We could not record the payment. Retry with the same details.",
    };
  }
}
