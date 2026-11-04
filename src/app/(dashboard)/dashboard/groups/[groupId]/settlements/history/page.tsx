import Link from "next/link";
import { groupPage } from "@/features/groups/group-page";
import { balances } from "@/features/balances/server";
import { formatPoisha } from "@/features/expenses/money";
import { paymentMethods } from "@/features/settlements/schema";
import { PageHeading } from "@/components/shared/page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export default async function SettlementHistoryPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const group = await groupPage(params),
    data = await balances.detail({ groupId: group.id });
  return (
    <>
      <PageHeading
        title="Settlement history"
        description="Completed payments only. Recorded payments are retained as part of your group’s financial history."
        action={
          <Button asChild>
            <Link href={`/dashboard/groups/${group.id}/settlements`}>
              Settle up
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent>
          {data.settlements.length ? (
            <ul className="divide-y">
              {data.settlements.map((s) => (
                <li
                  key={s.settlementId}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div className="min-w-0">
                    <h2 className="break-words font-medium">
                      {s.fromName} → {s.toName}
                    </h2>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {paymentMethods[s.method]} ·{" "}
                      {new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Dhaka",
                      }).format(new Date(s.createdAt))}{" "}
                      (Dhaka)
                    </p>
                  </div>
                  <p className="font-mono text-lg tabular-nums">
                    {formatPoisha(s.amountPoisha)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center">
              <h2 className="font-medium">No completed payments yet</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                When a completed payment is recorded, it will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
