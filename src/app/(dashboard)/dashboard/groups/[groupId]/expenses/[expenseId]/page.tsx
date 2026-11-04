import Link from "next/link";
import { notFound } from "next/navigation";
import { groupPage, unavailableAs404 } from "@/features/groups/group-page";
import { expenses } from "@/features/expenses/server";
import { ExpenseDelete } from "@/features/expenses/expense-panel";
import { expenseKeySchema } from "@/features/expenses/schema";
import { formatPoisha, poishaToDecimal } from "@/features/expenses/money";
import { PageHeading, SuccessNotice } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const methods = {
  EQUAL: "Equal split",
  EXACT: "Exact amounts",
  PERCENTAGE: "Percentages",
  SHARES: "Weighted shares",
};
export default async function ExpenseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; expenseId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const group = await groupPage(params),
    key = expenseKeySchema.safeParse(await params);
  if (!key.success) notFound();
  const expense = await unavailableAs404(() => expenses.detail(key.data)),
    query = await searchParams;
  return (
    <>
      <PageHeading
        title={expense.description}
        description={`Paid by ${expense.payerName} · ${expense.date}`}
        action={
          expense.canManage ? (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link
                  href={`/dashboard/groups/${group.id}/expenses/${expense.id}/edit`}
                >
                  Edit expense
                </Link>
              </Button>
              <ExpenseDelete expense={expense} redirectAfter />
            </div>
          ) : undefined
        }
      />
      {query.saved === "1" ? (
        <SuccessNotice>
          Expense saved. The allocations below are the saved server-calculated
          result.
        </SuccessNotice>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Total expense
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-all font-mono text-3xl font-semibold tabular-nums">
              {formatPoisha(expense.amountPoisha)}
            </p>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Split method</dt>
                <dd className="mt-1">{methods[expense.splitType]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Added by</dt>
                <dd className="mt-1 break-words">{expense.creatorName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Version</dt>
                <dd className="mt-1">{expense.version}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Included members</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {expense.splits.map((s) => (
                <li
                  key={s.userId}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {group.members.find((m) => m.userId === s.userId)?.name ??
                        "Former member"}
                    </p>
                    {s.inputUnits !== null ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Input:{" "}
                        {expense.splitType === "PERCENTAGE"
                          ? poishaToDecimal(BigInt(s.inputUnits)) + "%"
                          : expense.splitType === "EXACT"
                            ? formatPoisha(s.inputUnits)
                            : s.inputUnits + " shares"}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-mono tabular-nums">
                    {formatPoisha(s.amountPoisha)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Allocations are stored in integer poisha. The payer is included
              only when selected as a participant.
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 flex flex-wrap gap-5 text-sm text-primary">
        <Link href={`/dashboard/groups/${group.id}/expenses`}>
          ← All expenses
        </Link>
        <Link href={`/dashboard/groups/${group.id}/activity`}>
          View activity history →
        </Link>
      </div>
    </>
  );
}
