import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { groups } from "@/features/groups/server";
import { GroupError, type GroupDetail } from "@/features/groups/service";
import { groupIdSchema } from "@/features/groups/schema";
import { GroupControls } from "@/features/groups/group-controls";
import { expenses } from "@/features/expenses/server";
import { ExpensePanel } from "@/features/expenses/expense-panel";
export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSession();
  const { groupId } = await params;
  if (!groupIdSchema.safeParse(groupId).success) notFound();
  let group: GroupDetail;
  try {
    group = await groups.detail({ groupId });
  } catch (error) {
    if (error instanceof GroupError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const query = await searchParams;
  const page =
    query.page && /^[1-9]\d{0,4}$/.test(query.page) ? Number(query.page) : 1;
  const expensePage = await expenses.list({ groupId, page });
  return (
    <>
      <Link
        href="/dashboard/groups"
        className="mb-7 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Your groups
      </Link>
      <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
        A SHARED CHAPTER
      </p>
      <h1 className="break-words text-3xl font-medium tracking-tight sm:text-4xl">
        {group.name}
      </h1>
      <p className="mt-3 mb-9 max-w-xl break-words text-sm leading-7 text-muted-foreground">
        {group.description || "Good company. A fresh chapter."}
      </p>
      <GroupControls group={group} />
      <ExpensePanel group={group} items={expensePage.items} />
      <nav
        aria-label="Expense pages"
        className="mt-6 flex justify-between text-sm"
      >
        {page > 1 ? (
          <Link href={`?page=${page - 1}`}>← Previous</Link>
        ) : (
          <span />
        )}
        {expensePage.hasNext ? (
          <Link href={`?page=${page + 1}`}>Next →</Link>
        ) : null}
      </nav>
    </>
  );
}
