import Link from "next/link";
import { CircleCheck, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPoisha } from "@/features/expenses/money";
import { balances } from "./server";
import { BalanceInvariantError } from "./engine";
import type { BalanceDetail } from "./service";

function signed(value: string) {
  return (BigInt(value) > 0n ? "+" : "") + formatPoisha(value);
}
function state(value: string) {
  return BigInt(value) > 0n
    ? "Is owed"
    : BigInt(value) < 0n
      ? "Owes"
      : "Settled";
}
function Unavailable() {
  return (
    <div
      role="alert"
      className="my-7 rounded-xl border border-destructive/40 bg-destructive/5 p-5"
    >
      <h2 className="font-medium">Balances unavailable</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Some saved financial records do not reconcile. Review the group’s
        expense records before relying on a balance.
      </p>
    </div>
  );
}
function Summary({ owedBy, owedTo }: { owedBy: string; owedTo: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            You owe
          </CardTitle>
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="break-all font-mono text-2xl font-medium tabular-nums">
            {formatPoisha(owedBy)}
          </p>
        </CardContent>
      </Card>
      <Card className="border-primary/20 bg-primary/5 shadow-none">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-primary">
            You’re owed
          </CardTitle>
          <ArrowDownLeft className="size-4 text-primary" />
        </CardHeader>
        <CardContent>
          <p className="break-all font-mono text-2xl font-medium tabular-nums text-primary">
            {formatPoisha(owedTo)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
export async function DashboardBalances() {
  let data;
  try {
    data = await balances.overview();
  } catch (error) {
    if (error instanceof BalanceInvariantError) return <Unavailable />;
    throw error;
  }
  return (
    <section aria-label="Your balances" className="mt-8">
      <Summary owedBy={data.owedByPoisha} owedTo={data.owedToPoisha} />
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Across your active groups. Amounts owed in different groups are kept
        separate.
      </p>
      {data.groups.length ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            View balances by group
          </summary>
          <ul className="mt-3 divide-y rounded-xl border px-4">
            {data.groups.map((g) => (
              <li
                key={g.groupId}
                className="flex items-center justify-between gap-4 py-3"
              >
                <Link
                  href={`/dashboard/groups/${g.groupId}`}
                  className="min-w-0 truncate underline-offset-4 hover:underline"
                >
                  {g.name}
                </Link>
                <span className="shrink-0 text-right">
                  <span className="block font-mono tabular-nums">
                    {signed(g.netPoisha)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {state(g.netPoisha)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
function GroupPanel({ data }: { data: BalanceDetail }) {
  return (
    <section
      className="mt-10 border-t pt-8"
      aria-labelledby="group-balances-title"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="group-balances-title" className="text-xl font-medium">
            Group balances
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Positive means owed money. Negative means owes money.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs text-primary">
          <CircleCheck className="size-3.5" />
          Zero-sum verified · {formatPoisha(data.groupTotalPoisha)}
        </span>
      </div>
      <Summary
        owedBy={data.currentUser.owedByPoisha}
        owedTo={data.currentUser.owedToPoisha}
      />
      <div className="mt-5 overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Detailed member balance breakdown in BDT. Net = paid minus allocated
            plus sent minus received.
          </caption>
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {[
                "Member",
                "Paid",
                "Allocated",
                "Sent",
                "Received",
                "Net balance",
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.members.map((m) => (
              <tr key={m.memberId}>
                <th
                  scope="row"
                  className="min-w-40 max-w-56 break-words px-4 py-4 font-medium"
                >
                  {m.name}
                  {m.status !== "ACTIVE" ? (
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      Former member
                    </span>
                  ) : null}
                </th>
                {[
                  m.paidPoisha,
                  m.allocatedPoisha,
                  m.sentPoisha,
                  m.receivedPoisha,
                ].map((v, i) => (
                  <td
                    key={i}
                    className="whitespace-nowrap px-4 py-4 font-mono text-xs tabular-nums"
                  >
                    {formatPoisha(v)}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-4">
                  <span className="block font-mono font-medium tabular-nums">
                    {signed(m.netPoisha)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {state(m.netPoisha)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Net = paid − allocated + sent − received. Calculated from all saved
        group records, including former members.
      </p>
      <details className="mt-6 rounded-xl border p-5">
        <summary className="cursor-pointer text-sm font-medium">
          Expense contributions · {data.expenses.length}
        </summary>
        <div className="mt-4 space-y-5">
          {data.expenses.length ? (
            data.expenses.map((e) => (
              <article key={e.expenseId} className="border-t pt-4">
                <h3 className="break-words text-sm font-medium">
                  {e.description}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {e.date} · {formatPoisha(e.amountPoisha)}
                </p>
                <ul className="mt-3 space-y-3">
                  {e.contributions.map((c) => (
                    <li
                      key={c.memberId}
                      className="flex flex-wrap justify-between gap-2 text-sm"
                    >
                      <span className="break-words">
                        {c.name}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Paid {formatPoisha(c.paidPoisha)} · Allocated{" "}
                          {formatPoisha(c.allocatedPoisha)}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums">
                        {signed(c.netPoisha)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No active expenses yet.
            </p>
          )}
        </div>
      </details>
      <details className="mt-3 rounded-xl border p-5">
        <summary className="cursor-pointer text-sm font-medium">
          Recorded settlements · {data.settlements.length}
        </summary>
        <ul className="mt-4 space-y-4">
          {data.settlements.map((s) => (
            <li key={s.settlementId} className="border-t pt-4 text-sm">
              <p className="break-words">
                {s.fromName} → {s.toName} · {formatPoisha(s.amountPoisha)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.createdAt.slice(0, 10)} · {s.method.toLowerCase()}
              </p>
              <ul className="mt-2 space-y-1">
                {s.contributions.map((c) => (
                  <li
                    key={c.memberId}
                    className="flex flex-wrap justify-between gap-2 text-xs"
                  >
                    <span>{c.name}</span>
                    <span className="font-mono">{signed(c.netPoisha)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {!data.settlements.length ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No recorded settlements.
          </p>
        ) : null}
      </details>
    </section>
  );
}
export async function GroupBalances({ groupId }: { groupId: string }) {
  let data;
  try {
    data = await balances.detail({ groupId });
  } catch (error) {
    if (error instanceof BalanceInvariantError) return <Unavailable />;
    throw error;
  }
  return <GroupPanel data={data} />;
}
