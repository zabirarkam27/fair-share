"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
export function GroupNav({ groupId }: { groupId: string }) {
  const path = usePathname(),
    base = `/dashboard/groups/${groupId}`;
  return (
    <nav
      aria-label="Group"
      className="mb-8 flex gap-1 overflow-x-auto border-b pb-2"
    >
      {[
        ["", "Overview"],
        ["/expenses", "Expenses"],
        ["/balances", "Balances"],
        ["/settlements", "Settle up"],
        ["/settlements/history", "Payments"],
        ["/activity", "Activity"],
        ["/settings", "Settings"],
      ].map(([suffix, label]) => {
        const href = base + suffix;
        const active =
          suffix === "" || suffix === "/settlements"
            ? path === href
            : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-ring",
              active &&
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
