"use client";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatPoisha, poishaToDecimal } from "./money";
import {
  createExpense,
  editExpense,
  deleteExpense,
  previewExpense,
} from "./actions";

const selectStyle =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
export function ExpenseForm({
  group,
  expense,
  onSaved,
}: {
  group: GroupDetail;
  expense?: ExpenseDetail;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [requestKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    setValue,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ExpenseData>({
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
  const [previewState, setPreviewState] = useState<{
    input: string;
    data: {
      totalPoisha: string;
      splits: { userId: string; amountPoisha: string }[];
    };
  } | null>(null);
  const [previewPending, startPreview] = useTransition();
  const preview =
    previewState?.input === JSON.stringify(values) ? previewState.data : null;
  function previewInput(data: ExpenseData) {
    return {
      ...data,
      seed: requestKey,
      ...(expense ? { expenseId: expense.id, version: expense.version } : {}),
    };
  }
  const calculate = handleSubmit(
    (data) => {
      setError("");
      setPreviewState(null);
      const input = JSON.stringify(getValues());
      startPreview(async () => {
        try {
          const result = await previewExpense(previewInput(data));
          if (result.error) setError(result.error);
          else if (result.data) setPreviewState({ input, data: result.data });
        } catch {
          setError("Could not calculate the split. Please try again.");
        }
      });
    },
    () => setError("Check the description, amount, date and split values."),
  );
  const submit = handleSubmit(
    (data) => {
      setError("");
      startTransition(async () => {
        try {
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
          if (onSaved) onSaved();
          else if (result.data)
            router.push(
              `/dashboard/groups/${group.id}/expenses/${result.data.id}?saved=1`,
            );
          router.refresh();
        } catch {
          setError(
            "Connection interrupted. Keep this form open and retry with the same details.",
          );
        }
      });
    },
    () => setError("Check the description, amount, date and split values."),
  );
  return (
    <form
      onSubmit={submit}
      className="space-y-6"
      aria-busy={pending || previewPending}
    >
      <fieldset disabled={pending || previewPending} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="expense-description">Description</Label>
          <Input
            id="expense-description"
            required
            aria-invalid={!!errors.description}
            aria-describedby={
              errors.description ? "description-error" : undefined
            }
            maxLength={160}
            placeholder="Dinner, groceries, a shared ride…"
            {...register("description")}
          />
        </div>
        {errors.description ? (
          <p
            id="description-error"
            role="alert"
            className="text-sm text-destructive"
          >
            Enter a description of up to 160 characters.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
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
            <Input
              id="expense-date"
              required
              type="date"
              {...register("date")}
            />
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
                  (m) =>
                    m.status === "ACTIVE" || m.userId === expense?.paidById,
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
        <p className="rounded-lg bg-secondary p-4 text-sm leading-6 text-secondary-foreground">
          {values.splitType === "EQUAL"
            ? "Each included member gets an equal share. Rounding is handled automatically."
            : values.splitType === "EXACT"
              ? "Enter the exact BDT amount each person owes. The amounts must add up to the expense total."
              : values.splitType === "PERCENTAGE"
                ? "Enter each person’s percentage, up to two decimal places. The total must be exactly 100%."
                : "Enter a positive whole-number weight for each person. For example, 2:1:1 allocates half to the first person."}
        </p>
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
                            ? [
                                ...participants,
                                { memberId: m.userId, value: "" },
                              ]
                            : participants.filter(
                                (p) => p.memberId !== m.userId,
                              ),
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
        <Button
          type="button"
          variant="outline"
          onClick={() => void calculate()}
          disabled={pending || previewPending}
        >
          {previewPending ? "Calculating…" : "Preview split"}
        </Button>
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
                      {formatPoisha(s.amountPoisha)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Total {formatPoisha(preview.totalPoisha)}.{" "}
                {values.splitType === "EXACT"
                  ? "Exact amounts are preserved as entered."
                  : expense
                    ? "Rounding stays stable for this expense."
                    : "Rounding ties are rotated when saved; individual shares may differ by one poisha."}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Enter the details and select Preview split to see the
              server-calculated allocations.
            </p>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={pending || previewPending}
          className="w-full"
        >
          {pending ? "Saving…" : expense ? "Save changes" : "Add expense"}
        </Button>
      </fieldset>
    </form>
  );
}
export function ExpenseDelete({
  expense,
  redirectAfter = false,
}: {
  expense: ExpenseDetail;
  redirectAfter?: boolean;
}) {
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
            variant="destructive"
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
                  if (redirectAfter)
                    router.push(
                      `/dashboard/groups/${expense.groupId}/expenses?deleted=1`,
                    );
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
        <Button asChild>
          <Link href={`/dashboard/groups/${group.id}/expenses/new`}>
            Add expense
          </Link>
        </Button>
      </div>
      {items.length ? (
        <div className="space-y-4">
          {items.map((e) => (
            <article key={e.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-medium">
                    <Link
                      className="hover:underline underline-offset-4"
                      href={`/dashboard/groups/${group.id}/expenses/${e.id}`}
                    >
                      {e.description}
                    </Link>
                  </h3>
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
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/dashboard/groups/${group.id}/expenses/${e.id}/edit`}
                    >
                      Edit
                    </Link>
                  </Button>
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
