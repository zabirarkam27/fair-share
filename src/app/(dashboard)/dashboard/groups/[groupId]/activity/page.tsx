import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { GroupError } from "@/features/groups/service";
import { groupIdSchema } from "@/features/groups/schema";
import { activity } from "@/features/activity/server";
import { activityCursorSchema } from "@/features/activity/service";
import { ActivityList } from "@/features/activity/activity-list";
export default async function ActivityHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ before?: string; beforeId?: string }>;
}) {
  await requireSession();
  const { groupId } = await params;
  if (!groupIdSchema.safeParse(groupId).success) notFound();
  const query = await searchParams;
  let cursor;
  if (query.before !== undefined || query.beforeId !== undefined) {
    const parsed = activityCursorSchema.safeParse({
      createdAt: query.before,
      id: query.beforeId,
    });
    if (!parsed.success) notFound();
    cursor = parsed.data;
  }
  let data;
  try {
    data = await activity.list({ groupId, ...(cursor ? { cursor } : {}) });
  } catch (error) {
    if (error instanceof GroupError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const base = `/dashboard/groups/${groupId}/activity`;
  return (
    <>
      <Link
        href={`/dashboard/groups/${groupId}`}
        className="mb-7 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to group
      </Link>
      <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
        YOUR SHARED STORY
      </p>
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
        Activity history
      </h1>
      <p className="mt-3 mb-8 max-w-xl text-sm leading-7 text-muted-foreground">
        Who changed what, and when. Expense edits preserve the values before and
        after each change. Times are shown in Dhaka time.
      </p>
      <ActivityList data={data} />
      <nav
        aria-label="Activity pages"
        className="mt-6 flex justify-between gap-4 text-sm"
      >
        {cursor ? <Link href={base}>Latest activity</Link> : <span />}
        {data.nextCursor ? (
          <Link
            href={`${base}?before=${encodeURIComponent(data.nextCursor.createdAt)}&beforeId=${data.nextCursor.id}`}
          >
            Older activity →
          </Link>
        ) : null}
      </nav>
    </>
  );
}
