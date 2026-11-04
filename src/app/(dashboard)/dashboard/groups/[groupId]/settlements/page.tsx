import Link from "next/link";
import { groupPage } from "@/features/groups/group-page";
import { SettlementSection } from "@/features/settlements/settlement-section";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
export default async function SettlementsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const group = await groupPage(params);
  return (
    <>
      <PageHeading
        title="Settle up"
        description="A clear path back to zero. Suggestions do not change balances; record a payment only after money has changed hands."
        action={
          <Button asChild variant="outline">
            <Link href={`/dashboard/groups/${group.id}/settlements/history`}>
              Payment history
            </Link>
          </Button>
        }
      />
      <SettlementSection groupId={group.id} />
    </>
  );
}
