import { groupPage } from "@/features/groups/group-page";
import { expenses } from "@/features/expenses/server";
import { ExpensePanel } from "@/features/expenses/expense-panel";
import { PageHeading, SuccessNotice } from "@/components/shared/page-heading";
import Link from "next/link";
export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ page?: string; deleted?: string }>;
}) {
  const group = await groupPage(params),
    query = await searchParams;
  const page =
    query.page && /^[1-9]\d{0,4}$/.test(query.page) ? Number(query.page) : 1;
  const data = await expenses.list({ groupId: group.id, page });
  return (
    <>
      <PageHeading
        title="Expenses"
        description="A clear record of everything you share. Open an expense to see its saved allocations."
      />
      {query.deleted === "1" ? (
        <SuccessNotice>
          Expense deleted. Its activity history is retained.
        </SuccessNotice>
      ) : null}
      <ExpensePanel group={group} items={data.items} />
      <nav
        aria-label="Expense pages"
        className="mt-6 flex items-center justify-between text-sm"
      >
        {page > 1 ? (
          <Link href={`?page=${page - 1}`}>← Previous</Link>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">Page {page}</span>
        {data.hasNext ? (
          <Link href={`?page=${page + 1}`}>Next →</Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
