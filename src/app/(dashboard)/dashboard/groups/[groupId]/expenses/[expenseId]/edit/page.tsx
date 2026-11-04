import Link from "next/link";
import { notFound } from "next/navigation";
import { groupPage, unavailableAs404 } from "@/features/groups/group-page";
import { expenses } from "@/features/expenses/server";
import { ExpenseForm } from "@/features/expenses/expense-panel";
import { expenseKeySchema } from "@/features/expenses/schema";
import { PageHeading } from "@/components/shared/page-heading";
import { Card, CardContent } from "@/components/ui/card";
export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ groupId: string; expenseId: string }>;
}) {
  const group = await groupPage(params),
    key = expenseKeySchema.safeParse(await params);
  if (!key.success) notFound();
  const expense = await unavailableAs404(() => expenses.detail(key.data));
  if (!expense.canManage) notFound();
  return (
    <>
      <PageHeading
        title="Edit expense"
        description="Changes recalculate group balances. Previous values remain in activity history."
      />
      <Card className="max-w-3xl">
        <CardContent>
          <ExpenseForm group={group} expense={expense} />
        </CardContent>
      </Card>
      <Link
        className="mt-5 inline-block text-sm text-primary hover:underline"
        href={`/dashboard/groups/${group.id}/expenses/${expense.id}`}
      >
        Cancel and return to expense
      </Link>
    </>
  );
}
