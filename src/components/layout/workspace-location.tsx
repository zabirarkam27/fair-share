"use client";
import { usePathname } from "next/navigation";
export function WorkspaceLocation() {
  const path = usePathname();
  const label = path.includes("/activity")
    ? "Activity history"
    : path.includes("/settings")
      ? "Group settings"
      : path.endsWith("/expenses/new")
        ? "Add expense"
        : path.endsWith("/edit")
          ? "Edit expense"
          : path.includes("/expenses/")
            ? "Expense details"
            : path.endsWith("/expenses")
              ? "Expenses"
              : path.endsWith("/balances")
                ? "Balances"
                : path.endsWith("/settlements/history")
                  ? "Payment history"
                  : path.endsWith("/settlements")
                    ? "Settle up"
                    : path.endsWith("/groups")
                      ? "Your groups"
                      : path.includes("/groups/")
                        ? "Group overview"
                        : path.endsWith("/join")
                          ? "Join a group"
                          : "Dashboard";
  return <span className="font-medium">{label}</span>;
}
