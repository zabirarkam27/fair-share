import { ShieldCheck, ArrowUpRight, Sprout, CircleCheck } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { groups } from "@/features/groups/server";
import { GroupList } from "@/features/groups/group-list";
export default async function DashboardPage() {
  // Validate here too: a cached/shared layout alone is not an authorization boundary.
  const { user } = await requireSession();
  const list = await groups.list();
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
            YOUR SHARED WORLD
          </p>
          <h1 className="text-3xl font-medium tracking-[-1.1px] sm:text-4xl">
            Hey {user.name.split(" ")[0]}, welcome home.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            A fresh start for the moments you share.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5 px-3 py-2">
          <CircleCheck className="size-3.5" />
          Account ready
        </Badge>
      </div>
      <Card className="relative mt-9 overflow-hidden border-[#dce6cf] bg-[#eaf1e1] shadow-none">
        <CardHeader className="relative z-10 px-6 pt-7 sm:px-8">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-[#cfddbd] bg-[#dce9cb]">
            <Sprout className="size-6 text-primary" strokeWidth={1.5} />
          </div>
          <CardTitle className="text-2xl font-medium tracking-[-.7px]">
            A little clearer, together.
          </CardTitle>
          <CardDescription className="max-w-md text-sm leading-7 text-[#61734f]">
            Settle into your new space. Good company, shared moments, and a
            fresh start.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 px-6 pb-7 sm:px-8">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">
            Good company starts with you
            <ArrowUpRight className="size-3.5" />
          </span>
        </CardContent>
        <div
          aria-hidden="true"
          className="absolute -right-24 -bottom-48 size-96 rounded-full border border-[#cbd9b9] shadow-[0_0_0_30px_#dce6cf55,0_0_0_60px_#dce6cf33]"
        />
      </Card>
      <GroupList groups={list} />
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <div className="mb-2 flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                Your profile
              </CardTitle>
              <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <CardDescription>
              The account you’re signed in with.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="min-w-0 break-words text-right">{user.name}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t pt-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="min-w-0 break-all text-right">{user.email}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <div className="mb-2 flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                You’re signed in
              </CardTitle>
              <ShieldCheck className="size-5 text-primary" strokeWidth={1.5} />
            </div>
            <CardDescription>
              Come back and pick up where you left off.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-muted-foreground">
              Your session stays active when you refresh or return. On a shared
              device, sign out using the navigation menu when you’re done.
            </p>
            <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
              Only your authenticated account can access this workspace.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
