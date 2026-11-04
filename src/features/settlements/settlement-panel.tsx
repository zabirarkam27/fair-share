"use client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { formatPoisha, poishaToDecimal } from "@/features/expenses/money";
import {
  paymentMethods,
  recordSettlementSchema,
  type RecordSettlementInput,
} from "./schema";
import { recordSettlement } from "./actions";
import type { SettlementSuggestions } from "./service";
type Proposal = SettlementSuggestions["payments"][number];
const selectStyle =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
function RecordForm({
  data,
  proposal,
  onSaved,
}: {
  data: SettlementSuggestions;
  proposal?: Proposal;
  onSaved: () => void;
}) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition();
  const { debtors, creditors } = data.recordOptions;
  const [requestKey] = useState(() => crypto.randomUUID());
  const { register, handleSubmit } = useForm<RecordSettlementInput>({
    resolver: zodResolver(recordSettlementSchema),
    defaultValues: {
      groupId: data.groupId,
      fromId: proposal?.fromId ?? debtors[0]?.memberId ?? "",
      toId: proposal?.toId ?? creditors[0]?.memberId ?? "",
      amount: proposal ? poishaToDecimal(BigInt(proposal.amountPoisha)) : "",
      method: "BKASH",
      requestKey,
    },
  });
  const submit = handleSubmit(
    (input) => {
      setError("");
      startTransition(async () => {
        try {
          const result = await recordSettlement(input);
          if (result.error) setError(result.error);
          else {
            onSaved();
            router.refresh();
          }
        } catch {
          // Keep this form and its request key for a safe transport retry.
          setError(
            "Connection interrupted. Keep this form open and retry with the same details.",
          );
        }
      });
    },
    () => setError("Check the payment details."),
  );
  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="settlement-from">Paid by</Label>
          <select
            id="settlement-from"
            className={selectStyle}
            {...register("fromId")}
          >
            {debtors.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settlement-to">Paid to</Label>
          <select
            id="settlement-to"
            className={selectStyle}
            {...register("toId")}
          >
            {creditors.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="settlement-amount">Amount (BDT)</Label>
            <Input
              id="settlement-amount"
              required
              inputMode="decimal"
              placeholder="0.00"
              {...register("amount")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settlement-method">Payment method</Label>
            <select
              id="settlement-method"
              className={selectStyle}
              {...register("method")}
            >
              {Object.entries(paymentMethods).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          Record only a payment that has already happened. You can enter a
          partial payment; the remaining balance will be recalculated.
        </p>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Recording…" : "Record completed payment"}
        </Button>
      </fieldset>
    </form>
  );
}
function RecordDialog({
  data,
  proposal,
  onRecorded,
}: {
  data: SettlementSuggestions;
  proposal?: Proposal;
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={proposal ? "outline" : "default"}
          size={proposal ? "sm" : "default"}
        >
          {proposal ? "Record payment" : "Record a payment"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record a completed payment</DialogTitle>
          <DialogDescription>
            Confirm who paid, who received it, and how much.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <RecordForm
            data={data}
            proposal={proposal}
            onSaved={() => {
              setOpen(false);
              onRecorded();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
export function SettlementPanel({ data }: { data: SettlementSuggestions }) {
  const [notice, setNotice] = useState("");
  const recorded = () =>
    setNotice(
      "Payment recorded. Balances and suggestions have been recalculated.",
    );
  return (
    <section
      className="mt-10 border-t pt-8"
      aria-labelledby="settlement-suggestions-title"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="settlement-suggestions-title" className="text-xl font-medium">
            Payment suggestions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Suggestions become part of the balance only when a completed payment
            is recorded.
          </p>
        </div>
        {data.canRecord && data.payments.length ? (
          <RecordDialog data={data} onRecorded={recorded} />
        ) : null}
      </div>
      {notice ? (
        <p
          role="status"
          className="mb-5 rounded-lg bg-secondary p-4 text-sm text-primary"
        >
          {notice}
        </p>
      ) : null}
      {data.payments.length ? (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            {data.minimumGuaranteed
              ? "This plan clears the group with the fewest payments."
              : "Greedy matching clears the group; this plan is not guaranteed to use the fewest payments."}
          </p>
          <ul className="divide-y rounded-xl border px-5">
            {data.payments.map((p, i) => (
              <li
                key={`${p.fromId}-${p.toId}-${i}`}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm">
                    {p.fromName} → {p.toName}
                  </p>
                  <p className="mt-2 font-mono text-lg tabular-nums">
                    {formatPoisha(p.amountPoisha)}
                  </p>
                </div>
                {p.canRecord ? (
                  <RecordDialog
                    data={data}
                    proposal={p}
                    onRecorded={recorded}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Sender, receiver or admin can record
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Everyone is settled. No payments needed.
        </p>
      )}
    </section>
  );
}
