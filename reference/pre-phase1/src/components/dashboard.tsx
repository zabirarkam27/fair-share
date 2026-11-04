"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  LayoutDashboard,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Users,
  LogOut,
  Search,
  Receipt,
  Check,
  Copy,
  MoreHorizontal,
  Wallet,
  History,
  Settings,
  Trash2,
  Pencil,
  Palmtree,
  Home,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import type { Group, Overview, Expense } from "@/lib/types";
import { money, type Payment } from "@/lib/money";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import Modal from "./modal";
import ExpenseForm from "./expense-form";
type Person = { id: string; name: string; email: string };
type Dialog =
  "create" | "expense" | "settle" | "invite" | "settings" | "breakdown" | null;
const niceDate = (date: string) =>
  new Date(date.length === 10 ? date + "T12:00:00" : date).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", year: "numeric" },
  );
const first = (name: string) => name.split(" ")[0];
export default function Dashboard({
  person,
  groupId,
}: {
  person: Person;
  groupId?: string;
}) {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null),
    [group, setGroup] = useState<Group | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState("Expenses"),
    [query, setQuery] = useState(""),
    [dialog, setDialog] = useState<Dialog>(null),
    [editing, setEditing] = useState<Expense | undefined>(),
    [payment, setPayment] = useState<Payment | undefined>(),
    [breakdownId, setBreakdownId] = useState(""),
    [notice, setNotice] = useState(""),
    [mobile, setMobile] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const [home, detail] = await Promise.all([
        api<Overview>(""),
        groupId ? api<Group>("/groups/" + groupId) : Promise.resolve(null),
      ]);
      setOverview(home);
      setGroup(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your data.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);
  useEffect(() => {
    setLoading(true);
    setGroup(null);
    setTab("Expenses");
    setQuery("");
    void load();
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const saved = () => {
    setDialog(null);
    setEditing(undefined);
    setNotice("All saved. Everyone’s balances are up to date.");
    void load();
  };
  const name = (id: string) =>
    group?.members.find((m) => m.userId === id)?.name ?? "Former member";
  const openExpense = (e?: Expense) => {
    setEditing(e);
    setDialog("expense");
  };
  const canEdit = (e: Expense) =>
    e.createdBy === person.id || group?.myRole === "admin";
  const net = group?.balances[person.id] ?? 0;
  async function removeExpense(e: Expense) {
    if (
      !confirm(
        `Delete “${e.description}”? Its old values will remain in activity.`,
      )
    )
      return;
    try {
      await api(`/groups/${groupId}/expenses/${e.id}`, "DELETE", {
        version: e.version,
      });
      setNotice("Expense deleted. History preserved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    }
  }
  return (
    <div className="app-shell">
      <button
        className="mobile-menu icon-button"
        aria-label="Open navigation"
        onClick={() => setMobile(true)}
      >
        <Menu />
      </button>
      {mobile && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "nav-open" : "")}>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Layers size={23} />
          </span>
          fairshare<span className="brand-dot">.</span>
        </Link>
        <span className="workspace-label">YOUR SHARED WORLD</span>
        <Link
          className={"nav-item " + (!groupId ? "active" : "")}
          href="/"
          onClick={() => setMobile(false)}
        >
          <LayoutDashboard size={19} />
          Overview
        </Link>
        <div className="nav-section">
          <span>YOUR GROUPS</span>
          <button
            className="icon-button"
            aria-label="Create group"
            onClick={() => setDialog("create")}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="group-links">
          {overview?.groups.map((g, i) => (
            <Link
              href={"/groups/" + g.id}
              key={g.id}
              className={"nav-item " + (groupId === g.id ? "active" : "")}
              onClick={() => setMobile(false)}
            >
              {/flat|home|house/i.test(g.name) ? <Home size={18} /> : <Palmtree size={18} />}
              <span>{g.name}</span>
            </Link>
          ))}
          {overview?.groups.length === 0 && (
            <p className="sidebar-hint">Your groups will feel at home here.</p>
          )}
        </div>
        <button className="new-group" onClick={() => setDialog("create")}>
          <Plus size={17} />
          Create a group
        </button>
        <div className="sidebar-bottom">
          <div className="together-card">
            <span className="little-orbit">✳</span>
            <strong>
              Less math.
              <br />
              More good company.
            </strong>
            <p>
              Every shared moment,
              <br />
              fairly accounted for.
            </p>
          </div>
          <div className="profile">
            <span className="avatar">{person.name.charAt(0)}</span>
            <div>
              <strong>{person.name}</strong>
              <small title={person.email}>{person.email}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                await authClient.signOut();
                window.location.href = "/login";
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="muted">Your workspace</span>
            <ChevronRight size={14} />
            <strong>{group?.name ?? "Overview"}</strong>
          </div>
          <span className="currency-badge">
            <span /> BDT · Bangladeshi taka
          </span>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {groupId ? "A SHARED CHAPTER" : "THE BIG PICTURE"}
              </span>
              <h1>
                {group
                  ? group.name
                  : groupId
                    ? "Your group"
                    : `Hey ${first(person.name)}, all in balance?`}
              </h1>
              <p className="muted">
                {group
                  ? group.description || "Good company. Clear balances."
                  : "A little overview of what’s shared, what’s owed, and what’s next."}
              </p>
            </div>
            <div className="heading-actions">
              {group && (
                <button
                  className="secondary"
                  onClick={() => setDialog("invite")}
                >
                  <Users size={17} />
                  Invite friends
                </button>
              )}
              <button
                className="primary"
                onClick={() => (group ? openExpense() : setDialog("create"))}
              >
                <Plus size={18} />
                {group ? "Add expense" : "Create a group"}
              </button>
            </div>
          </div>
          {error && (
            <div className="error error-banner" role="alert">
              {error}
              <button className="text-button" onClick={() => void load()}>
                Try again
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading">
              <span className="spinner" /> Gathering your shared world…
            </div>
          ) : (
            !error && (
              <>
                <div className="stats-grid">
                  <Stat
                    label={group ? "YOUR GROUP BALANCE" : "YOU ARE OWED"}
                    value={group ? Math.abs(net) : (overview?.owed ?? 0)}
                    kind="mint"
                    icon={<ArrowDownLeft size={20} />}
                    note={
                      group
                        ? net > 0
                          ? "A little coming your way"
                          : net < 0
                            ? "Your share to settle"
                            : "All square. Feels good."
                        : "A little coming your way"
                    }
                    prefix={group && net < 0 ? "You owe " : ""}
                  />
                  <Stat
                    label={group ? "GROUP SPENDING" : "YOU OWE"}
                    value={
                      group
                        ? group.expenses.reduce((s, e) => s + e.amount, 0)
                        : (overview?.owe ?? 0)
                    }
                    kind="peach"
                    icon={
                      group ? <Receipt size={20} /> : <ArrowUpRight size={20} />
                    }
                    note={
                      group
                        ? `${group.expenses.length} shared expenses, accounted for`
                        : "Your share of the good times"
                    }
                  />
                  <div className="stat-card paper">
                    <div className="stat-top">
                      <span>{group ? "GOOD COMPANY" : "SHARING WITH"}</span>
                      <span className="stat-icon">
                        <Users size={19} />
                      </span>
                    </div>
                    <strong className="stat-number">
                      {group
                        ? group.members.filter((m) => m.active).length
                        : (overview?.groups.length ?? 0)}
                      <span className="stat-unit">
                        {group ? "members" : "groups"}
                      </span>
                    </strong>
                    <p>
                      {group
                        ? "Everyone has a place at the table"
                        : "Big adventures. Everyday little things."}
                    </p>
                  </div>
                </div>
                {!groupId && (
                  <>
                    <section className="section-heading">
                      <div>
                        <h2>
                          Your groups{" "}
                          <span className="count">
                            {overview?.groups.length ?? 0}
                          </span>
                        </h2>
                        <p className="muted">
                          Life’s better when you share it.
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setDialog("create")}
                      >
                        New group <Plus size={16} />
                      </button>
                    </section>
                    <div className="group-grid">
                      {overview?.groups.map((g, i) => (
                        <Link
                          className="group-card"
                          key={g.id}
                          href={"/groups/" + g.id}
                        >
                          <div className={"group-art art-" + (i % 3)}>
                            <span className="group-illustration">
                              {/flat|home|house/i.test(g.name) ? (
                                <Home size={46} strokeWidth={1.25} />
                              ) : (
                                <Palmtree size={46} strokeWidth={1.25} />
                              )}
                            </span>
                            <span className="group-category">
                              {/flat|home|house/i.test(g.name)
                                ? "EVERYDAY TOGETHER"
                                : "MAKING MEMORIES"}
                            </span>
                            <ArrowUpRight size={20} />
                          </div>
                          <div className="group-body">
                            <div className="group-card-title">
                              <h3>{g.name}</h3>
                              <span className="member-pill">
                                <Users size={13} />
                                {g.memberCount}
                              </span>
                            </div>
                            <p>
                              {g.description || "A new chapter, shared fairly."}
                            </p>
                            <div className="group-footer">
                              <span>
                                {g.balance > 0
                                  ? "You are owed"
                                  : g.balance < 0
                                    ? "You owe"
                                    : "All settled up"}
                              </span>
                              <strong
                                className={g.balance < 0 ? "debt" : "credit"}
                              >
                                {money(Math.abs(g.balance))}
                              </strong>
                            </div>
                          </div>
                        </Link>
                      ))}
                      <button
                        className="group-card add-group-card"
                        onClick={() => setDialog("create")}
                      >
                        <span className="dashed-plus">
                          <Plus size={25} />
                        </span>
                        <strong>Start something shared</strong>
                        <p>
                          A flat, a trip, a weekly dinner.
                          <br />
                          Make room for your next group.
                        </p>
                        <span className="text-button">
                          Create a group <ArrowRight size={15} />
                        </span>
                      </button>
                    </div>
                    <section className="overview-bottom">
                      <div className="tip-art">
                        <Layers size={35} strokeWidth={1.3} />
                      </div>
                      <div>
                        <span className="eyebrow">
                          SMALL CHANGE, BIG PEACE OF MIND
                        </span>
                        <h3>Fair down to the last poisha.</h3>
                        <p>
                          Every split adds up exactly. Because the little things
                          matter when you’re sharing.
                        </p>
                      </div>
                      <span className="tip-check">
                        <Check size={21} />
                      </span>
                    </section>
                  </>
                )}
                {group && (
                  <>
                    <div
                      className="tabs"
                      role="tablist"
                      aria-label="Group sections"
                    >
                      {[
                        { label: "Expenses", icon: Receipt },
                        { label: "Balances", icon: Wallet },
                        { label: "Activity", icon: History },
                        { label: "Members", icon: Users },
                      ].map(({ label, icon: Icon }) => (
                        <button
                          role="tab"
                          aria-selected={tab === label}
                          key={label}
                          onClick={() => setTab(label)}
                          className={tab === label ? "active" : ""}
                        >
                          <Icon size={17} />
                          {label}
                          {label === "Expenses" && (
                            <span>{group.expenses.length}</span>
                          )}
                        </button>
                      ))}
                      <button
                        className="group-settings"
                        aria-label="Group settings"
                        onClick={() => setDialog("settings")}
                      >
                        <Settings size={18} />
                      </button>
                    </div>
                    {tab === "Expenses" && (
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>The shared tab</h2>
                            <p className="muted">
                              All the little things that add up.
                            </p>
                          </div>
                          <label className="search-box">
                            <Search size={17} />
                            <input
                              aria-label="Search expenses"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder="Find an expense…"
                            />
                          </label>
                        </div>
                        {group.expenses.length === 0 ? (
                          <Empty
                            title="A fresh start, together."
                            text="Add your first shared expense to get things rolling."
                            action={() => openExpense()}
                            actionText="Add an expense"
                          />
                        ) : (
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>EXPENSE</th>
                                  <th>PAID BY</th>
                                  <th>SPLIT</th>
                                  <th className="number">AMOUNT</th>
                                  <th className="number">YOUR SHARE</th>
                                  <th>
                                    <span className="sr-only">Actions</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.expenses
                                  .filter((e) =>
                                    e.description
                                      .toLowerCase()
                                      .includes(query.toLowerCase()),
                                  )
                                  .map((e) => (
                                    <tr key={e.id}>
                                      <td>
                                        <button
                                          className="expense-description"
                                          onClick={() => {
                                            setEditing(e);
                                            setBreakdownId("");
                                            setDialog("breakdown");
                                          }}
                                        >
                                          <span className="expense-icon">
                                            <Receipt size={18} />
                                          </span>
                                          <span>
                                            <strong>{e.description}</strong>
                                            <small>{niceDate(e.date)}</small>
                                          </span>
                                        </button>
                                      </td>
                                      <td>
                                        <span className="person-cell">
                                          <span className="avatar tiny">
                                            {name(e.paidBy).charAt(0)}
                                          </span>
                                          {e.paidBy === person.id
                                            ? "You"
                                            : first(name(e.paidBy))}
                                        </span>
                                      </td>
                                      <td>
                                        <span className="split-badge">
                                          {e.splitType === "exact"
                                            ? "Exact"
                                            : e.splitType[0].toUpperCase() +
                                              e.splitType.slice(1)}{" "}
                                          · {e.allocations.length}
                                        </span>
                                      </td>
                                      <td className="number strong">
                                        {money(e.amount)}
                                      </td>
                                      <td className="number muted">
                                        {money(
                                          e.allocations.find(
                                            (a) => a.userId === person.id,
                                          )?.amount ?? 0,
                                        )}
                                      </td>
                                      <td>
                                        {canEdit(e) && (
                                          <div className="row-actions">
                                            <button
                                              className="icon-button"
                                              aria-label={
                                                "Edit " + e.description
                                              }
                                              onClick={() => openExpense(e)}
                                            >
                                              <Pencil size={15} />
                                            </button>
                                            <button
                                              className="icon-button"
                                              aria-label={
                                                "Delete " + e.description
                                              }
                                              onClick={() =>
                                                void removeExpense(e)
                                              }
                                            >
                                              <Trash2 size={15} />
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                            {query &&
                              !group.expenses.some((e) =>
                                e.description
                                  .toLowerCase()
                                  .includes(query.toLowerCase()),
                              ) && (
                                <p className="empty-small">
                                  No expenses match “{query}”.
                                </p>
                              )}
                          </div>
                        )}
                        <div className="panel-footer">
                          <span>
                            <span className="live-dot" /> Balances calculated
                            from your shared history
                          </span>
                          <span>Every poisha accounted for</span>
                        </div>
                      </section>
                    )}
                    {tab === "Balances" && (
                      <div className="balance-layout">
                        <section className="panel">
                          <div className="panel-heading">
                            <div>
                              <h2>Where everyone stands</h2>
                              <p className="muted">
                                Tap a balance to follow the numbers.
                              </p>
                            </div>
                          </div>
                          {group.members.map((m) => (
                            <button
                              className="balance-row"
                              key={m.userId}
                              onClick={() => {
                                setBreakdownId(m.userId);
                                setEditing(undefined);
                                setDialog("breakdown");
                              }}
                            >
                              <span className="avatar">{m.name.charAt(0)}</span>
                              <div>
                                <strong>
                                  {m.name}
                                  {m.userId === person.id ? " (you)" : ""}
                                </strong>
                                <small>
                                  {!m.active
                                    ? "Former member"
                                    : group.balances[m.userId] > 0
                                      ? "Is owed"
                                      : group.balances[m.userId] < 0
                                        ? "Owes"
                                        : "All settled up"}
                                </small>
                              </div>
                              <strong
                                className={
                                  group.balances[m.userId] < 0
                                    ? "debt"
                                    : "credit"
                                }
                              >
                                {money(Math.abs(group.balances[m.userId]))}
                              </strong>
                              <ChevronRight size={16} />
                            </button>
                          ))}
                        </section>
                        <section className="panel settlement-panel">
                          <div className="panel-heading">
                            <div>
                              <h2>A clear way to settle</h2>
                              <p className="muted">
                                Fewer payments. More peace of mind.
                              </p>
                            </div>
                          </div>
                          {group.suggestions.length ? (
                            group.suggestions.map((p, i) => (
                              <div
                                className="payment-card"
                                key={p.fromId + p.toId}
                              >
                                <span className="step">{i + 1}</span>
                                <div>
                                  <strong>
                                    {first(name(p.fromId))}
                                    <ArrowRight size={14} />
                                    {first(name(p.toId))}
                                  </strong>
                                  <span>{money(p.amount)}</span>
                                </div>
                                {(p.fromId === person.id ||
                                  p.toId === person.id ||
                                  group.myRole === "admin") && (
                                  <button
                                    className="secondary compact"
                                    onClick={() => {
                                      setPayment(p);
                                      setDialog("settle");
                                    }}
                                  >
                                    Record
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <Empty
                              title="All square."
                              text="No payments needed. Enjoy the good company."
                            />
                          )}
                          <p className="hint padded">
                            Suggestions use a fast greedy algorithm; they may
                            not be the absolute minimum number of payments.
                            Record only payments actually made.
                          </p>
                          <button
                            className="text-button padded"
                            onClick={() => {
                              setPayment(undefined);
                              setDialog("settle");
                            }}
                          >
                            Record another payment <Plus size={15} />
                          </button>
                        </section>
                        <section className="panel settlement-history">
                          <div className="panel-heading">
                            <h2>Recorded payments</h2>
                          </div>
                          {group.settlements.length ? (
                            group.settlements.map((s) => (
                              <div className="history-row" key={s.id}>
                                <span className="settled-icon">
                                  <Check size={16} />
                                </span>
                                <div>
                                  <strong>
                                    {name(s.fromId)} paid {name(s.toId)}
                                  </strong>
                                  <small>
                                    {niceDate(s.createdAt)} · {s.method}
                                  </small>
                                </div>
                                <strong>{money(s.amount)}</strong>
                              </div>
                            ))
                          ) : (
                            <p className="empty-small">
                              Your recorded payments will appear here.
                            </p>
                          )}
                        </section>
                      </div>
                    )}
                    {tab === "Activity" && (
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>The whole story</h2>
                            <p className="muted">
                              Latest 100 changes. Old values stay visible.
                            </p>
                          </div>
                          <History size={21} />
                        </div>
                        <div className="activity-list">
                          {group.activity.map((a) => (
                            <div className="activity-item" key={a.id}>
                              <span className="avatar small">
                                {name(a.actorId).charAt(0)}
                              </span>
                              <div>
                                <p>
                                  <strong>{name(a.actorId)}</strong> {a.action}
                                </p>
                                <small>
                                  {new Date(a.createdAt).toLocaleString(
                                    "en-GB",
                                  )}
                                </small>
                                {(!!a.before || !!a.after) && (
                                  <details>
                                    <summary>
                                      View{" "}
                                      {a.before && a.after
                                        ? "before & after"
                                        : "details"}
                                    </summary>
                                    <div className="snapshot-grid">
                                      {!!a.before && (
                                        <Snapshot
                                          title="Before"
                                          value={a.before}
                                          group={group}
                                        />
                                      )}{" "}
                                      {!!a.after && (
                                        <Snapshot
                                          title="After"
                                          value={a.after}
                                          group={group}
                                        />
                                      )}
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                    {tab === "Members" && (
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>Your people</h2>
                            <p className="muted">
                              Shared moments, individual permissions.
                            </p>
                          </div>
                          <button
                            className="secondary"
                            onClick={() => setDialog("invite")}
                          >
                            <Plus size={16} />
                            Invite
                          </button>
                        </div>
                        {group.members.map((m) => (
                          <div className="member-row" key={m.userId}>
                            <span className="avatar">{m.name.charAt(0)}</span>
                            <div>
                              <strong>
                                {m.name}
                                {m.userId === person.id ? " (you)" : ""}
                              </strong>
                              <small>
                                {!m.active
                                  ? "Former member · history preserved"
                                  : m.role === "admin"
                                    ? "Group admin"
                                    : "Member"}
                              </small>
                            </div>
                            {m.active &&
                              m.role !== "admin" &&
                              (group.myRole === "admin" ||
                                m.userId === person.id) && (
                                <button
                                  className="text-button danger"
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        m.userId === person.id
                                          ? "Leave this group? Your balance must be zero."
                                          : `Remove ${m.name}? Their balance must be zero.`,
                                      )
                                    )
                                      return;
                                    try {
                                      await api(
                                        `/groups/${group.id}/members/${m.userId}`,
                                        "DELETE",
                                        {},
                                      );
                                      if (m.userId === person.id)
                                        router.push("/");
                                      else await load();
                                    } catch (e) {
                                      setError(
                                        e instanceof Error
                                          ? e.message
                                          : "Could not remove member.",
                                      );
                                    }
                                  }}
                                >
                                  {m.userId === person.id
                                    ? "Leave group"
                                    : "Remove"}
                                </button>
                              )}
                          </div>
                        ))}
                      </section>
                    )}
                  </>
                )}
              </>
            )
          )}
          <footer className="main-footer">
            <span>
              fairshare<span className="brand-dot">.</span>
            </span>
            <span>A little clearer, together.</span>
            <span>
              Made for the moments you share{" "}
              <span className="footer-star">✳</span>
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {dialog === "create" && (
        <Modal title="Start something shared" onClose={() => setDialog(null)}>
          <CreateGroup
            onDone={(id) => {
              setDialog(null);
              router.push("/groups/" + id);
            }}
          />
        </Modal>
      )}
      {dialog === "expense" && group && (
        <Modal
          title={editing ? "Edit shared expense" : "Add a shared expense"}
          onClose={() => setDialog(null)}
        >
          <ExpenseForm
            group={group}
            personId={person.id}
            expense={editing}
            onSaved={saved}
          />
        </Modal>
      )}
      {dialog === "invite" && group && (
        <Modal title="Good company starts here" onClose={() => setDialog(null)}>
          <p className="muted">
            Share this link with people you trust. Anyone with it can sign in
            and join {group.name}.
          </p>
          <label>
            Group invitation
            <input
              readOnly
              value={window.location.origin + "/join/" + group.inviteToken}
            />
          </label>
          <button
            className="primary wide"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  window.location.origin + "/join/" + group.inviteToken,
                );
                setNotice("Invite link copied.");
              } catch {
                setNotice("Select and copy the invitation link above.");
              }
            }}
          >
            <Copy size={17} />
            Copy invite link
          </button>
          {group.myRole === "admin" && (
            <button
              className="text-button spaced"
              onClick={async () => {
                try {
                  await api("/groups/" + group.id + "/invite", "POST", {});
                  await load();
                  setNotice("New link created. The old one no longer works.");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not replace link.",
                  );
                }
              }}
            >
              Replace this link
            </button>
          )}
        </Modal>
      )}
      {dialog === "settle" && group && (
        <Modal title="A little more settled" onClose={() => setDialog(null)}>
          <SettlementForm
            group={group}
            person={person}
            payment={payment}
            onDone={saved}
          />
        </Modal>
      )}
      {dialog === "settings" && group && (
        <Modal title="Group settings" onClose={() => setDialog(null)}>
          <p className="muted">
            {group.name} · {group.members.filter((m) => m.active).length} active
            members
          </p>
          <p className="notice">
            Members can add expenses. An expense’s author and the group admin
            can edit or delete it. Members need a zero balance to leave.
          </p>
          {group.myRole === "admin" ? (
            <DeleteGroup
              group={group}
              onDone={() => {
                setDialog(null);
                router.push("/");
              }}
            />
          ) : (
            <p>Only the group admin can delete this group.</p>
          )}
        </Modal>
      )}
      {dialog === "breakdown" && group && (
        <Modal
          title={
            editing
              ? editing.description
              : `${first(name(breakdownId))}’s balance explained`
          }
          onClose={() => setDialog(null)}
          wide
        >
          {editing ? (
            <>
              <p className="muted">
                {niceDate(editing.date)} · Paid by {name(editing.paidBy)} ·{" "}
                {editing.splitType} split
              </p>
              <div className="breakdown-total">
                <span>Total expense</span>
                <strong>{money(editing.amount)}</strong>
              </div>
              {editing.allocations.map((a) => (
                <div className="line-row" key={a.userId}>
                  <span>{name(a.userId)}</span>
                  <strong>{money(a.amount)}</strong>
                </div>
              ))}
              <p className="hint">
                Added by {name(editing.createdBy)} · Revision {editing.version}
              </p>
            </>
          ) : (
            <>
              <p className="muted">
                Paid for the group − personal shares + payments sent − payments
                received.
              </p>
              {group.expenses
                .filter(
                  (e) =>
                    e.paidBy === breakdownId ||
                    e.allocations.some((a) => a.userId === breakdownId),
                )
                .map((e) => {
                  const paid = e.paidBy === breakdownId ? e.amount : 0,
                    share =
                      e.allocations.find((a) => a.userId === breakdownId)
                        ?.amount ?? 0;
                  return (
                    <div className="line-row" key={e.id}>
                      <div>
                        <strong>{e.description}</strong>
                        <small>
                          {niceDate(e.date)} · Paid {money(paid)} − share{" "}
                          {money(share)}
                        </small>
                      </div>
                      <strong className={paid - share < 0 ? "debt" : "credit"}>
                        {money(paid - share)}
                      </strong>
                    </div>
                  );
                })}
              {group.settlements
                .filter(
                  (s) => s.fromId === breakdownId || s.toId === breakdownId,
                )
                .map((s) => (
                  <div className="line-row" key={s.id}>
                    <div>
                      <strong>
                        {s.fromId === breakdownId
                          ? "Payment sent"
                          : "Payment received"}
                      </strong>
                      <small>
                        {niceDate(s.createdAt)} · {s.method}
                      </small>
                    </div>
                    <strong>
                      {money(s.fromId === breakdownId ? s.amount : -s.amount)}
                    </strong>
                  </div>
                ))}
              <div className="breakdown-total">
                <span>Net balance · positive = is owed</span>
                <strong>{money(group.balances[breakdownId] ?? 0)}</strong>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  kind,
  icon,
  note,
  prefix = "",
}: {
  label: string;
  value: number;
  kind: string;
  icon: React.ReactNode;
  note: string;
  prefix?: string;
}) {
  return (
    <div className={"stat-card " + kind}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong className="stat-number">
        <small>{prefix}</small>
        {money(value)}
      </strong>
      <p>{note}</p>
    </div>
  );
}
function Empty({
  title,
  text,
  action,
  actionText,
}: {
  title: string;
  text: string;
  action?: () => void;
  actionText?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Receipt size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="secondary" onClick={action}>
          <Plus size={16} />
          {actionText}
        </button>
      )}
    </div>
  );
}
function CreateGroup({ onDone }: { onDone: (id: string) => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          const r = await api<{ id: string }>("/groups", "POST", {
            name: f.get("name"),
            description: f.get("description"),
          });
          onDone(r.id);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not create.");
          setBusy(false);
        }
      }}
    >
      <p className="muted">Give your flat, trip, or dinner club a home.</p>
      <label>
        Group name
        <input
          autoFocus
          required
          name="name"
          maxLength={80}
          placeholder="e.g. The Dhanmondi flat"
        />
      </label>
      <label>
        A little description (optional)
        <textarea
          name="description"
          maxLength={240}
          rows={3}
          placeholder="What brings you together?"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary wide" disabled={busy}>
        {busy ? "Creating…" : "Create group"}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
function SettlementForm({
  group,
  person,
  payment,
  onDone,
}: {
  group: Group;
  person: Person;
  payment?: Payment;
  onDone: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          await api("/groups/" + group.id + "/settlements", "POST", {
            fromId: f.get("fromId"),
            toId: f.get("toId"),
            amount: f.get("amount"),
            method: f.get("method"),
            requestId,
          });
          onDone();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not record.");
          setBusy(false);
        }
      }}
    >
      <p className="notice">
        Record a payment that has already happened. FairShare does not transfer
        money. Either party (or the admin) can record it.
      </p>
      <label>
        Who paid?
        <select name="fromId" defaultValue={payment?.fromId ?? person.id}>
          {group.members
            .filter((m) => m.active)
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Who received it?
        <select
          name="toId"
          defaultValue={
            payment?.toId ??
            group.members.find((m) => m.active && m.userId !== person.id)
              ?.userId
          }
        >
          {group.members
            .filter((m) => m.active)
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          Amount (BDT)
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={payment ? (payment.amount / 100).toFixed(2) : ""}
            required
            placeholder="0.00"
          />
        </label>
        <label>
          Payment method
          <select name="method">
            <option>bKash</option>
            <option>Cash</option>
            <option>Bank</option>
          </select>
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary wide" disabled={busy}>
        {busy ? "Recording…" : "Record payment"}
        <Check size={17} />
      </button>
    </form>
  );
}
function DeleteGroup({ group, onDone }: { group: Group; onDone: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/groups/" + group.id, "DELETE", {
            name: new FormData(e.currentTarget).get("name"),
          });
          onDone();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not delete.");
          setBusy(false);
        }
      }}
    >
      <h3 className="danger">Delete group</h3>
      <p className="hint">
        Permanently deletes all expenses, settlements, and group activity, even
        if balances are outstanding. Export or review the history first.
      </p>
      <label>
        Type “{group.name}” to confirm
        <input name="name" required autoComplete="off" />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="danger-button" disabled={busy}>
        Delete group permanently
      </button>
    </form>
  );
}
function Snapshot({
  title,
  value,
  group,
}: {
  title: string;
  value: unknown;
  group: Group;
}) {
  const data = value as Record<string, unknown>;
  const memberName = (id: unknown) =>
    group.members.find((m) => m.userId === id)?.name ?? String(id ?? "");
  return (
    <div className="snapshot">
      <span className="eyebrow">{title}</span>
      {typeof data.description === "string" && (
        <strong>{data.description}</strong>
      )}
      {typeof data.name === "string" && <strong>{data.name}</strong>}
      {typeof data.amount === "number" && <p>{money(data.amount)}</p>}
      {typeof data.date === "string" && <p>{niceDate(data.date)}</p>}
      {data.paidBy !== undefined && <p>Paid by {memberName(data.paidBy)}</p>}
      {data.fromId !== undefined && (
        <p>
          {memberName(data.fromId)} → {memberName(data.toId)} ·{" "}
          {String(data.method)}
        </p>
      )}
      {data.splitType !== undefined && <p>{String(data.splitType)} split</p>}
      {Array.isArray(data.allocations) &&
        data.allocations.map((a: { userId: string; amount: number }) => (
          <div key={a.userId} className="snapshot-allocation">
            <span>{memberName(a.userId)}</span>
            <span>{money(a.amount)}</span>
          </div>
        ))}
      {Array.isArray(data.inputs) && (
        <p className="hint">
          Entered:{" "}
          {data.inputs
            .map(
              (i: { userId: string; value: string }) =>
                `${memberName(i.userId)} ${i.value}`,
            )
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

