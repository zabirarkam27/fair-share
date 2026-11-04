import Link from "next/link";
import { ArrowUpRight, Users, Link2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { groups } from "@/features/groups/server";
import { DashboardBalances } from "@/features/balances/balance-panel";
import { RecentActivity } from "@/features/activity/recent-activity";
import { QuickExpense } from "@/features/groups/quick-expense";
import { CreateGroupButton } from "@/features/groups/create-group-button";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
export default async function DashboardPage() {
  const { user } = await requireSession();
  const list = await groups.list();
  return (
    <>
      <PageHeading
        eyebrow="Your money, together"
        title={`Hello, ${user.name.split(" ")[0]}.`}
        description="Shared spending, clear balances. Here’s where you stand."
        action={<QuickExpense groups={list} />}
      />
      <DashboardBalances />
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="bg-primary text-primary-foreground ring-0">
          <CardContent className="flex h-full flex-col items-start justify-between gap-6 p-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-white/75">
                Less math. More life.
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Good company.
                <br />
                Clear accounts.
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/80">
                Keep trips, home expenses and everyday moments in their own
                groups.
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/dashboard/groups">
                Your groups <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Quick actions</h2>
            <p className="mt-2 mb-6 text-sm text-muted-foreground">
              Make room for the next shared moment.
            </p>
            <div className="flex flex-col items-start gap-4">
              <CreateGroupButton />
              <Button asChild variant="outline">
                <Link href="/dashboard/join">
                  <Link2 className="size-4" />
                  Join with an invitation
                </Link>
              </Button>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="size-4" />
                {list.length} active {list.length === 1 ? "group" : "groups"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <RecentActivity />
    </>
  );
}
