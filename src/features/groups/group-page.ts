import "server-only";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { groupIdSchema } from "./schema";
import { GroupError } from "./service";
import { groups } from "./server";
export async function groupPage(params: Promise<{ groupId: string }>) {
  await requireSession();
  const { groupId } = await params;
  if (!groupIdSchema.safeParse(groupId).success) notFound();
  return unavailableAs404(() => groups.detail({ groupId }));
}
export async function unavailableAs404<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof GroupError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
