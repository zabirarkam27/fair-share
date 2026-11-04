import Link from "next/link";
import { Clock3, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { activity } from "./server";
import { actionLabels } from "./activity-list";
export async function RecentActivity() {
  const rows = await activity.recent();
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock3 className="size-5 text-primary" />
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/dashboard/groups/${row.groupId}/activity`}
                  className="flex items-center gap-4 rounded-lg py-4 hover:bg-secondary/50"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary"
                  >
                    {row.actorName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm">
                      <span className="font-medium">{row.actorName}</span> ·{" "}
                      {actionLabels[row.action]}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {row.groupName} ·{" "}
                      <time dateTime={row.createdAt}>
                        {new Intl.DateTimeFormat("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Dhaka",
                        }).format(new Date(row.createdAt))}{" "}
                        (Dhaka)
                      </time>
                    </p>
                  </div>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center">
            <p className="font-medium">Your shared story starts here</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Create or join a group to see its activity in your dashboard.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
