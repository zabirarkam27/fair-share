import { groupPage } from "@/features/groups/group-page";
import { GroupControls } from "@/features/groups/group-controls";
import { PageHeading } from "@/components/shared/page-heading";
export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const group = await groupPage(params);
  return (
    <>
      <PageHeading
        title="Group settings"
        description={
          group.myRole === "ADMIN"
            ? "Manage invitations and membership. Destructive actions always require confirmation."
            : "View your group’s members and roles. Invitations and membership are managed by the group admin."
        }
      />
      <GroupControls group={group} />
    </>
  );
}
