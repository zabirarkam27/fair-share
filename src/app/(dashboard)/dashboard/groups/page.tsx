import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { groups } from "@/features/groups/server";
import { GroupList } from "@/features/groups/group-list";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
export default async function GroupsPage() {
  await requireSession();
  const list = await groups.list();
  return (
    <>
      <PageHeading
        eyebrow="A place for your people"
        title="Your groups"
        description="Separate spaces for shared spending. Choose a group to manage expenses and settle up."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/join">Join a group</Link>
          </Button>
        }
      />
      <GroupList groups={list} />
    </>
  );
}
