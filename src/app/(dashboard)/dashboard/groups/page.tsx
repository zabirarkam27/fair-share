import { requireSession } from "@/lib/auth/session";
import { groups } from "@/features/groups/server";
import { GroupList } from "@/features/groups/group-list";
export default async function GroupsPage() {
  await requireSession();
  const list = await groups.list();
  return (
    <>
      <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
        GOOD COMPANY STARTS HERE
      </p>
      <h1 className="text-3xl font-medium tracking-tight">
        A shared world, all yours.
      </h1>
      <GroupList groups={list} />
    </>
  );
}
