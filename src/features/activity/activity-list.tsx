import { formatPoisha, poishaToDecimal } from "@/features/expenses/money";
import { paymentMethods } from "@/features/settlements/schema";
import type { ActivityPage } from "./service";
import type { ActivityAction, ActivitySnapshot } from "./metadata";
export const actionLabels: Record<ActivityAction, string> = {
  GROUP_CREATED: "Created the group",
  GROUP_DELETED: "Deleted the group",
  MEMBER_JOINED: "Joined the group",
  MEMBER_REMOVED: "Removed a member",
  EXPENSE_CREATED: "Added an expense",
  EXPENSE_UPDATED: "Edited an expense",
  EXPENSE_DELETED: "Deleted an expense",
  SETTLEMENT_RECORDED: "Recorded a settlement",
  INVITE_ROTATED: "Generated an invitation",
  INVITE_REVOKED: "Revoked the invitation",
};
const labels: Record<string, string> = {
  description: "Description",
  name: "Name",
  amountPoisha: "Amount",
  date: "Expense date",
  paidById: "Paid by",
  createdById: "Created by",
  fromId: "Sender",
  toId: "Receiver",
  memberId: "Member",
  splitType: "Split method",
  version: "Version",
  deletedAt: "Deleted at",
  role: "Role",
  status: "Membership",
  joinedAt: "Joined at",
  departedAt: "Departed at",
  active: "Invitation active",
  expiresAt: "Expires at",
  method: "Payment method",
  createdAt: "Recorded at",
};
function timestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
}
function Snapshot({
  value,
  names,
}: {
  value: ActivitySnapshot | null;
  names: Map<string, string>;
}) {
  if (!value)
    return (
      <p className="text-xs text-muted-foreground">
        No snapshot available for this event.
      </p>
    );
  const data = value as Record<string, unknown>;
  function display(key: string, entry: unknown): string {
    if (entry === null) return "None";
    if (key === "amountPoisha" && typeof entry === "string")
      return formatPoisha(entry);
    if (
      ["paidById", "createdById", "fromId", "toId", "memberId"].includes(key) &&
      typeof entry === "string"
    ) {
      if (key === "paidById" && typeof data.payerName === "string")
        return data.payerName;
      if (key === "createdById" && typeof data.creatorName === "string")
        return data.creatorName;
      if (key === "memberId" && typeof data.name === "string") return data.name;
      return names.get(entry) ?? "Former or unknown member";
    }
    if (
      key === "method" &&
      typeof entry === "string" &&
      entry in paymentMethods
    )
      return paymentMethods[entry as keyof typeof paymentMethods];
    if (key.endsWith("At") && typeof entry === "string")
      return timestamp(entry) + " (Dhaka)";
    if (typeof entry === "boolean") return entry ? "Yes" : "No";
    return String(entry);
  }
  const entries = Object.entries(data).filter(
    ([key]) => key in labels && key !== "name",
  );
  if ("name" in data && !("memberId" in data))
    entries.unshift(["name", data.name]);
  return (
    <div className="space-y-4">
      <dl className="space-y-3 text-xs">
        {entries.map(([key, entry]) => (
          <div key={key} className="grid gap-1">
            <dt className="text-muted-foreground">{labels[key]}</dt>
            <dd className="break-words font-medium">{display(key, entry)}</dd>
          </div>
        ))}
      </dl>
      {"splits" in value ? (
        <div>
          <h4 className="mb-3 text-xs font-medium">
            Saved participant allocations
          </h4>
          <ul className="space-y-3 text-xs">
            {value.splits.map((s) => (
              <li
                key={s.userId}
                className="flex flex-wrap justify-between gap-2"
              >
                <span className="min-w-0 break-words">
                  {names.get(s.userId) ?? "Former or unknown member"}
                  {s.inputUnits !== null ? (
                    <span className="mt-1 block text-muted-foreground">
                      Original input:{" "}
                      {value.splitType === "EXACT"
                        ? formatPoisha(s.inputUnits)
                        : value.splitType === "PERCENTAGE"
                          ? poishaToDecimal(BigInt(s.inputUnits)) + "%"
                          : s.inputUnits + " shares"}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono tabular-nums">
                  {formatPoisha(s.amountPoisha)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
export function ActivityList({ data }: { data: ActivityPage }) {
  const names = new Map(data.memberNames.map((m) => [m.memberId, m.name]));
  if (!data.items.length)
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No activity to show.
      </p>
    );
  return (
    <ol className="space-y-4">
      {data.items.map((event) => (
        <li key={event.id} className="rounded-xl border bg-card p-5 sm:p-6">
          <article>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">
                  {event.actorName} · {actionLabels[event.action]}
                </h2>
                <time
                  dateTime={event.createdAt}
                  className="mt-2 block text-xs text-muted-foreground"
                >
                  {timestamp(event.createdAt)} (Dhaka)
                </time>
              </div>
              <span className="self-start rounded-full bg-secondary px-2.5 py-1 text-[10px] text-muted-foreground">
                Recorded history
              </span>
            </div>
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                View event details
                {event.action === "EXPENSE_UPDATED"
                  ? " · old and new values"
                  : ""}
              </summary>
              <p className="mt-4 break-all font-mono text-[10px] text-muted-foreground">
                Resource: {event.resourceId}
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {event.before ||
                [
                  "EXPENSE_UPDATED",
                  "EXPENSE_DELETED",
                  "MEMBER_REMOVED",
                  "GROUP_DELETED",
                ].includes(event.action) ? (
                  <section className="rounded-lg border bg-muted/20 p-4">
                    <h3 className="mb-4 text-xs font-semibold">
                      Previous values
                    </h3>
                    <Snapshot value={event.before} names={names} />
                  </section>
                ) : null}
                <section className="rounded-lg border p-4">
                  <h3 className="mb-4 text-xs font-semibold">New values</h3>
                  <Snapshot value={event.after} names={names} />
                </section>
              </div>
            </details>
          </article>
        </li>
      ))}
    </ol>
  );
}
