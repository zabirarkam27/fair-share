"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { GroupError } from "@/features/groups/service";
import { MoneyError } from "./money";
import { expenses } from "./server";
async function run<T>(operation: () => Promise<T>) {
  try {
    const data = await operation();
    revalidatePath("/dashboard", "layout");
    return { data };
  } catch (error) {
    if (error instanceof GroupError || error instanceof MoneyError)
      return { error: error.message };
    if (error instanceof ZodError)
      return { error: "Check all expense fields and try again." };
    console.error(
      "Expense operation failed",
      error instanceof Error ? error.name : "Unknown",
    );
    return { error: "We could not save this expense. Please try again." };
  }
}
export async function createExpense(input: unknown) {
  return run(() => expenses.create(input));
}
export async function editExpense(input: unknown) {
  return run(() => expenses.edit(input));
}
export async function deleteExpense(input: unknown) {
  return run(() => expenses.delete(input));
}
