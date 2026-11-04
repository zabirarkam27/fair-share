"use client";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { GroupDetail } from "@/features/groups/service";
import type { ExpenseDetail } from "./service";
import { expenseDataSchema, type ExpenseData } from "./schema";
import { calculateExpense } from "./calculate";
import { formatPoisha, poishaToDecimal } from "./money";
import { createExpense, editExpense, deleteExpense } from "./actions";

const selectStyle =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
function ExpenseForm({
  group,
  expense,
  onSaved,
}: {
  group: GroupDetail;
  expense?: ExpenseDetail;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [requestKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const { register, control, setValue, handleSubmit } = useForm<ExpenseData>({
    resolver: zodResolver(expenseDataSchema),
    defaultValues: expense
      ? {
          groupId: group.id,
          description: expense.description,
          amount: poishaToDecimal(BigInt(expense.amountPoisha)),
          date: expense.date,
          paidById: expense.paidById,
          splitType: expense.splitType,
          participants: expense.splits.map((s) => ({
            memberId: s.userId,
            value:
              s.inputUnits === null
                ? ""
                : expense.splitType === "EXACT"
                  ? poishaToDecimal(BigInt(s.inputUnits))
                  : expense.splitType === "PERCENTAGE"
                    ? poishaToDecimal(BigInt(s.inputUnits))
                    : s.inputUnits,
          })),
        }
      : {
          groupId: group.id,
          description: "",
          amount: "",
          date: new Date().toLocaleDateString("en-CA"),
          paidById: group.members.find((m) => m.role === "ADMIN")?.userId ?? "",
          splitType: "EQUAL",
          participants: group.members
            .filter((m) => m.status === "ACTIVE")
            .map((m) => ({ memberId: m.userId, value: "" })),
        },
  });
  const values = useWatch({ control }) as ExpenseData;
  const participants = values.participants ?? [];
  let preview: ReturnType<typeof calculateExpense> | undefined;
  let previewError = "";
  try {
    preview = calculateExpense(values, expense?.id ?? requestKey);
  } catch (e) {
    previewError = e instanceof Error ? e.message : "Enter expense details.";
  }
  const submit = handleSubmit(
    (data) => {
      setError("");
      startTransition(async () => {
        const result = expense
          ? await editExpense({
              ...data,
              expenseId: expense.id,
              version: expense.version,
            })
          : await createExpense({ ...data, requestKey });
        if (result.error) {
          setError(result.error);
          return;
        }
        onSaved();
        router.refresh();
      });
    },
    () => setError("Check the description, amount, date and split values."),
  );
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="expense-description">Description</Label>
        <Input
          id="expense-description"
          required
          maxLength={160}
          placeholder="Dinner, groceries, a shared ride…"
          {...register("description")}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expense-amount">Amount (BDT)</Label>
          <Input
            id="expense-amount"
            required
            inputMode="decimal"
            placeholder="0.00"
            {...register("amount")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-date">Date</Label>
          <Input id="expense-date" required type="date" {...register("date")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expense-payer">Paid by</Label>
          <select
            id="expense-payer"
            className={selectStyle}
            {...register("paidById")}
          >
            {group.members
              .filter(
                (m) => m.status === "ACTIVE" || m.userId === expense?.paidById,
              )
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                  {m.status !== "ACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-method">Split method</Label>
          <select
            id="expense-method"
            className={selectStyle}
            {...register("splitType", {
              onChange: () =>
                setValue(
                  "participants",
                  participants.map((p) => ({ ...p, value: "" })),
                ),
            })}
          >
            <option value="EQUAL">Equally</option>
            <option value="EXACT">Exact amounts</option>
            <option value="PERCENTAGE">Percentages</option>
            <option value="SHARES">Weighted shares</option>
          </select>
        </div>
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">
          Participants
          {values.splitType === "EXACT"
            ? " · BDT"
            : values.splitType === "PERCENTAGE"
              ? " · % (up to 2 decimals)"
              : values.splitType === "SHARES"
                ? " · positive whole weights"
                : ""}
        </legend>
        {group.members
          .filter(
            (m) =>
              m.status === "ACTIVE" ||
              participants.some((p) => p.memberId === m.userId),
          )
          .map((m) => {
            const index = participants.findIndex(
              (p) => p.memberId === m.userId,
            );
            return (
              <div key={m.userId} className="flex items-center gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={index >= 0}
                    disabled={m.status !== "ACTIVE"}
                    onChange={(e) =>
                      setValue(
                        "participants",
                        e.target.checked
                          ? [...participants, { memberId: m.userId, value: "" }]
                          : participants.filter((p) => p.memberId !== m.userId),
                      )
                    }
                    className="size-4 accent-primary"
                  />
                  <span className="truncate">
                    {m.name}
                    {m.status !== "ACTIVE" ? " (inactive)" : ""}
                  </span>
                </label>
                {index >= 0 && values.splitType !== "EQUAL" ? (
                  <Input
                    aria-label={`${m.name} split value`}
                    className="w-28"
                    inputMode={
                      values.splitType === "SHARES" ? "numeric" : "decimal"
                    }
                    required
                    {...register(`participants.${index}.value`)}
                  />
                ) : null}
              </div>
            );
          })}
      </fieldset>
      <div className="rounded-lg bg-muted/50 p-4 text-sm" aria-live="polite">
        <p className="mb-2 font-medium">Split preview</p>
        {preview ? (
          <>
            <ul className="space-y-2">
              {preview.splits.map((s) => (
                <li key={s.userId} className="flex justify-between gap-4">
                  <span className="truncate">
                    {group.members.find((m) => m.userId === s.userId)?.name}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatPoisha(s.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Total {formatPoisha(preview.total)}.{" "}
              {expense
                ? "Rounding stays stable for this expense."
                : "Rounding ties are rotated when saved; individual shares may differ by one poisha."}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">{previewError}</p>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !preview} className="w-full">
        {pending ? "Saving…" : expense ? "Save changes" : "Add expense"}
      </Button>
    </form>
  );
}
function ExpenseEditor({
  group,
  expense,
}: {
  group: GroupDetail;
  expense?: ExpenseDetail;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={expense ? "outline" : "default"}
          size={expense ? "sm" : "default"}
        >
          {expense ? (
            "Edit"
          ) : (
            <>
              <Plus className="size-4" />
              Add expense
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {expense ? "Edit expense" : "A shared expense"}
          </DialogTitle>
          <DialogDescription>
            Record what was paid and who shared it. The payer can be excluded
            from participants.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ExpenseForm
            group={group}
            expense={expense}
            onSaved={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
function ExpenseDelete({ expense }: { expense: ExpenseDetail }) {
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
          <AlertDialogDescription>
            “{expense.description}” will be removed from active expenses. Its
            history will be retained.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep expense</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await deleteExpense({
                  groupId: expense.groupId,
                  expenseId: expense.id,
                  version: expense.version,
                });
                if (result.error) setError(result.error);
                else {
                  setOpen(false);
                  router.refresh();
                }
              });
            }}
          >
            {pending ? "Deleting…" : "Delete expense"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function ExpensePanel({
  group,
  items,
}: {
  group: GroupDetail;
  items: ExpenseDetail[];
}) {
  return (
    <section className="mt-10 border-t pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium">Shared expenses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every poisha, accounted for.
          </p>
        </div>
        <ExpenseEditor group={group} />
      </div>
      {items.length ? (
        <div className="space-y-4">
          {items.map((e) => (
            <article key={e.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-medium">{e.description}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.date} · Paid by {e.payerName} ·{" "}
                    {e.splitType.toLowerCase()}
                  </p>
                </div>
                <p className="font-mono text-lg tabular-nums">
                  {formatPoisha(e.amountPoisha)}
                </p>
              </div>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  {e.splits.length} participants · View split
                </summary>
                <ul className="mt-3 space-y-2">
                  {e.splits.map((s) => (
                    <li key={s.userId} className="flex justify-between gap-4">
                      <span className="truncate">
                        {group.members.find((m) => m.userId === s.userId)
                          ?.name ?? "Former member"}
                      </span>
                      <span className="font-mono">
                        {formatPoisha(s.amountPoisha)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Added by {e.creatorName}
                </p>
              </details>
              {e.canManage ? (
                <div className="mt-4 flex justify-end gap-2">
                  <ExpenseEditor group={group} expense={e} />
                  <ExpenseDelete expense={e} />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <ReceiptText className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Your shared story starts with the first expense.
          </p>
        </div>
      )}
    </section>
  );
}
