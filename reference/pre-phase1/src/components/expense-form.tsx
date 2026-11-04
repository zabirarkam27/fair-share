"use client";
import { useState } from "react";
import type { Group, Expense } from "@/lib/types";
import { decimalUnits, money, splitMoney, type SplitType } from "@/lib/money";
import { api } from "@/lib/api-client";
export default function ExpenseForm({
  group,
  personId,
  expense,
  onSaved,
}: {
  group: Group;
  personId: string;
  expense?: Expense;
  onSaved: () => void;
}) {
  const active = group.members.filter((m) => m.active);
  const [type, setType] = useState<SplitType>(
    (expense?.splitType as SplitType) ?? "equal",
  );
  const [amount, setAmount] = useState(
    expense ? (expense.amount / 100).toFixed(2) : "",
  );
  const [selected, setSelected] = useState(
    expense ? expense.inputs.map((i) => i.userId) : active.map((m) => m.userId),
  );
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      expense?.inputs.map((i) => [i.userId, i.value]) ??
        active.map((m) => [m.userId, "1"]),
    ),
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const inputs = selected.map((userId) => ({
    userId,
    value: values[userId] ?? "0",
  }));
  let preview: ReturnType<typeof splitMoney> = [];
  let previewError = "";
  try {
    if (amount)
      preview = splitMoney(
        decimalUnits(amount),
        type,
        inputs,
        expense?.id ?? "preview",
      );
  } catch (e) {
    previewError = e instanceof Error ? e.message : "";
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api(
        "/groups/" + group.id + "/expenses" + (expense ? "/" + expense.id : ""),
        expense ? "PUT" : "POST",
        {
          description: form.get("description"),
          amount,
          date: form.get("date"),
          paidBy: form.get("paidBy"),
          splitType: type,
          inputs,
          ...(expense ? { version: expense.version } : {}),
        },
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <label>
        What was it for?
        <input
          autoFocus
          name="description"
          defaultValue={expense?.description}
          placeholder="e.g. Groceries for the week"
          required
          maxLength={160}
        />
      </label>
      <div className="form-grid">
        <label>
          Amount (BDT)
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label>
          Date
          <input
            name="date"
            type="date"
            defaultValue={
              expense?.date ?? new Date().toLocaleDateString("en-CA")
            }
            required
          />
        </label>
      </div>
      <label>
        Paid by
        <select name="paidBy" defaultValue={expense?.paidBy ?? personId}>
          {active.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
              {m.userId === personId ? " (you)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label>How should we split it?</label>
      <div className="split-options">
        {(["equal", "exact", "percentage", "shares"] as const).map((t) => (
          <button
            type="button"
            key={t}
            className={t === type ? "selected" : ""}
            onClick={() => setType(t)}
          >
            {t === "exact" ? "Exact amounts" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <p className="hint">
        {type === "equal"
          ? "Split evenly between selected people. Remainder poisha may vary when saved."
          : type === "exact"
            ? "Enter each person’s amount in BDT."
            : type === "percentage"
              ? "Enter percentages adding up to exactly 100%."
              : "Enter positive weights, e.g. 2 : 1 : 1."}
      </p>
      <div className="participants">
        {active.map((m) => (
          <div className="participant" key={m.userId}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={selected.includes(m.userId)}
                onChange={(e) =>
                  setSelected((old) =>
                    e.target.checked
                      ? [...old, m.userId]
                      : old.filter((id) => id !== m.userId),
                  )
                }
              />
              <span className="avatar small">{m.name.charAt(0)}</span>
              {m.name}
            </label>
            {selected.includes(m.userId) &&
              (type === "equal" ? (
                <span className="mono">
                  {money(
                    preview.find((p) => p.userId === m.userId)?.amount ?? 0,
                  )}
                </span>
              ) : (
                <input
                  aria-label={`${m.name} ${type}`}
                  className="split-input"
                  inputMode="decimal"
                  value={values[m.userId] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [m.userId]: e.target.value })
                  }
                  required
                />
              ))}
          </div>
        ))}
      </div>
      {previewError && <p className="hint warning">{previewError}</p>}
      {expense && (
        <p className="notice">
          Editing changes current balances, including expenses that were
          previously settled. The old values stay in activity.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary wide"
        disabled={busy || !!previewError || !selected.length}
      >
        {busy ? "Saving…" : expense ? "Save changes" : "Add expense"}
      </button>
    </form>
  );
}
