import { inviteTokenSchema } from "@/features/groups/schema";
export function inviteReturn(
  value: string | string[] | undefined,
): string | undefined {
  const result = inviteTokenSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
