import Link from "next/link";
import { ArrowUpRight, ReceiptText, Wallet, Users, Clock3 } from "lucide-react";
import { groupPage } from "@/features/groups/group-page";
import { expenses } from "@/features/expenses/server";
import { ExpensePanel } from "@/features/expenses/expense-panel";
import { GroupBalances } from "@/features/balances/balance-panel";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const group = await groupPage(params),
    base = `/dashboard/groups/${group.id}`;
  const expensePage = await expenses.list({ groupId: group.id, page: 1 });
  return (
    <>
      <PageHeading
        title="Group overview"
        description={
          group.description ||
          "Every shared moment, every poisha accounted for."
        }
        action={
          <Button asChild>
            <Link href={`${base}/expenses/new`}>Add expense</Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            path: "/expenses",
            label: "All expenses",
            detail: "Browse shared costs",
            icon: ReceiptText,
          },
          {
            path: "/settlements",
            label: "Settle up",
            detail: "View payment suggestions",
            icon: Wallet,
          },
          {
            path: "/settings",
            label: "Members & settings",
            detail: `${group.members.filter((m) => m.status === "ACTIVE").length} active members`,
            icon: Users,
          },
          {
            path: "/activity",
            label: "Activity history",
            detail: "Who changed what",
            icon: Clock3,
          },
        ].map(({ path, label, detail, icon: Icon }) => (
          <Link
            key={path}
            href={base + path}
            className="rounded-xl border bg-card p-5 hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="mb-4 flex justify-between text-primary">
              <Icon className="size-5" />
              <ArrowUpRight className="size-4" />
            </div>
            <h2 className="text-sm font-semibold">{label}</h2>
            <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
          </Link>
        ))}
      </div>
      <GroupBalances groupId={group.id} />
      <ExpensePanel group={group} items={expensePage.items.slice(0, 5)} />
      {expensePage.items.length ? (
        <Link
          href={`${base}/expenses`}
          className="mt-5 inline-flex text-sm font-medium text-primary hover:underline"
        >
          View all expenses →
        </Link>
      ) : null}
    </>
  );
}
