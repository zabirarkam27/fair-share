"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { groups } from "./server";
import { GroupError } from "./service";
import type { GroupService } from "./service";

type Failure = { error: string; code: string };
async function run<T>(
  operation: () => Promise<T>,
): Promise<{ data: T } | Failure> {
  try {
    const data = await operation();
    revalidatePath("/dashboard", "layout");
    return { data };
  } catch (error) {
    if (error instanceof GroupError)
      return { error: error.message, code: error.code };
    if (error instanceof ZodError)
      return {
        error: "Check the group details and try again.",
        code: "VALIDATION",
      };
    console.error(
      "Group operation failed",
      error instanceof Error ? error.name : "Unknown",
    );
    return {
      error: "We could not save that change. Please try again.",
      code: "UNAVAILABLE",
    };
  }
}
export async function createGroup(input: unknown) {
  return run(() => groups.create(input));
}
export async function issueInvite(input: unknown) {
  return run(() => groups.issueInvite(input));
}
export async function revokeInvite(input: unknown) {
  return run(() => groups.revokeInvite(input));
}
export async function joinGroup(input: unknown) {
  return run(() => groups.join(input));
}
export async function removeMember(input: unknown) {
  return run(() => groups.remove(input));
}
export async function deleteGroup(input: unknown) {
  return run(() => groups.delete(input));
}
// No reads are exported as public actions: authorized Server Components call services.
export type GroupActionResult<T extends keyof GroupService> = Awaited<
  ReturnType<GroupService[T]>
>;
