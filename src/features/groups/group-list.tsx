import Link from "next/link";
import { Users, ArrowUpRight, Layers } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateGroupButton } from "./create-group-button";
import type { GroupSummary } from "./service";
export function GroupList({
  groups,
  query = "",
}: {
  groups: GroupSummary[];
  query?: string;
}) {
  const matches = groups.filter((group) =>
    group.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="mt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium tracking-tight">
            Your groups{" "}
            <span className="ml-2 text-sm text-muted-foreground">
              {groups.length}
            </span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A place for the things you share.
          </p>
        </div>
        <CreateGroupButton />
      </div>
      <form
        action="/dashboard/groups"
        method="get"
        role="search"
        aria-label="Your groups"
        className="mb-6"
      >
        <Label htmlFor="group-search">Search by group name</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            id="group-search"
            name="q"
            type="search"
            maxLength={80}
            defaultValue={query}
            placeholder="Find a group…"
            className="min-w-0 flex-1 basis-48"
          />
          <Button type="submit">Search</Button>
          {query && (
            <Button asChild variant="outline">
              <Link href="/dashboard/groups">Clear search</Link>
            </Button>
          )}
        </div>
      </form>
      {query && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {matches.length} of {groups.length} groups match your search.
        </p>
      )}
      {matches.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {matches.map((group) => (
            <Link
              href={"/dashboard/groups/" + group.id}
              key={group.id}
              className="group rounded-xl focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
            >
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Layers className="size-5" strokeWidth={1.5} />
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="truncate text-lg font-medium">
                    {group.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 min-h-10 leading-6">
                    {group.description || "Good company. A fresh chapter."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between border-t pt-4">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      {group.memberCount}{" "}
                      {group.memberCount === 1 ? "member" : "members"}
                    </span>
                    <Badge variant="secondary">
                      {group.role === "ADMIN" ? "Admin" : "Member"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="border-dashed bg-muted/30 py-8 text-center shadow-none">
          <CardContent>
            <Layers
              className="mx-auto mb-4 size-8 text-primary"
              strokeWidth={1.5}
            />
            <h3 className="text-lg font-medium">
              {query ? "No matching groups." : "Make room for your people."}
            </h3>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
              {query
                ? "Try another group name or clear your search to see all your groups."
                : "Create your first group or accept an invitation from a friend. Your groups will appear here."}
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
