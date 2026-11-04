import Link from "next/link";
import { groupPage } from "@/features/groups/group-page";
import { ExpenseForm } from "@/features/expenses/expense-panel";
import { PageHeading } from "@/components/shared/page-heading";
import { Card, CardContent } from "@/components/ui/card";
export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const group = await groupPage(params);
  return (
    <>
      <PageHeading
        title="Add expense"
        description="Record a shared cost. Choose who paid, who participated, and how to split it."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardContent>
            <ExpenseForm group={group} />
          </CardContent>
        </Card>
        <aside className="rounded-xl border bg-secondary/40 p-6 text-sm leading-7">
          <h2 className="font-semibold">A fair split starts here</h2>
          <p className="mt-3 text-muted-foreground">
            The payer can be excluded from participants. Use Preview split to
            check allocations before saving. Saved allocations are the final
            record.
          </p>
          <Link
            className="mt-5 inline-block font-medium text-primary hover:underline"
            href={`/dashboard/groups/${group.id}/expenses`}
          >
            Cancel and return to expenses
          </Link>
        </aside>
      </div>
    </>
  );
}
