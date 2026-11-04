import { groupPage } from "@/features/groups/group-page";
import { GroupBalances } from "@/features/balances/balance-panel";
import { PageHeading } from "@/components/shared/page-heading";
export default async function BalancesPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const group = await groupPage(params);
  return (
    <>
      <PageHeading
        title="Balance overview"
        description="Your complete ledger, calculated from saved expenses and completed payments. Positive means owed money; negative means owes money."
      />
      <GroupBalances groupId={group.id} />
    </>
  );
}
