import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { groupPage } from "@/features/groups/group-page";
import { GroupNav } from "@/features/groups/group-nav";
import { Badge } from "@/components/ui/badge";
export default async function GroupLayout({
  params,
  children,
}: {
  params: Promise<{ groupId: string }>;
  children: React.ReactNode;
}) {
  const group = await groupPage(params);
  return (
    <>
      <Link
        href="/dashboard/groups"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        All groups
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Users className="size-5" />
          </span>
          <p className="break-words text-lg font-semibold">{group.name}</p>
        </div>
        <Badge variant="secondary">
          {group.myRole === "ADMIN" ? "Admin" : "Member"} · BDT
        </Badge>
      </div>
      <GroupNav groupId={group.id} />
      {children}
    </>
  );
}
