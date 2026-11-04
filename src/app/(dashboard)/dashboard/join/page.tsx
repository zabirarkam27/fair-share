import { requireSession } from "@/lib/auth/session";
import { InviteEntry } from "@/features/groups/invite-entry";
import { PageHeading } from "@/components/shared/page-heading";
import { Card, CardContent } from "@/components/ui/card";
export default async function JoinGroupPage() {
  await requireSession();
  return (
    <>
      <PageHeading
        title="Join a group"
        description="Have an invitation? Paste the link below to join your people."
      />
      <Card className="max-w-xl">
        <CardContent>
          <InviteEntry />
        </CardContent>
      </Card>
    </>
  );
}
