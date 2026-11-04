import { auth } from "../src/lib/auth";
import { db, pool } from "../src/lib/db";
import { user, groups, members } from "../src/lib/schema";
import { eq } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { saveExpense, settle } from "../src/lib/service";
const accounts = [
  ["Rafi Ahmed", "rafi"],
  ["Nusrat Jahan", "nusrat"],
  ["Tanvir Hasan", "tanvir"],
  ["Mahi Rahman", "mahi"],
];
try {
  const ids: string[] = [];
  for (const [name, slug] of accounts) {
    const email = slug + "@fairshare.demo";
    const [existing] = await db
      .select()
      .from(user)
      .where(eq(user.email, email));
    if (existing) ids.push(existing.id);
    else {
      const result = await auth.api.signUpEmail({
        body: { name, email, password: "FairShareDemo!2026" },
      });
      ids.push(result.user.id);
    }
  }
  for (const [id, name, description, count] of [
    [
      "demo-dhanmondi",
      "The Dhanmondi flat",
      "Everyday life at House 24. Rent, groceries & the good stuff.",
      3,
    ],
    [
      "demo-coxs-bazar",
      "Cox’s Bazar getaway",
      "Sea breeze, long weekends & memories worth sharing.",
      4,
    ],
  ] as const) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, id));
    if (existing) continue;
    await db.transaction(async (tx) => {
      await tx
        .insert(groups)
        .values({
          id,
          name,
          description,
          inviteToken: randomBytes(24).toString("hex"),
        });
      await tx
        .insert(members)
        .values(
          ids
            .slice(0, count)
            .map((userId, i) => ({
              groupId: id,
              userId,
              role: i === 0 ? "admin" : "member",
            })),
        );
    });
    const add = async (
      description: string,
      amount: string,
      date: string,
      payer: number,
      splitType: "equal" | "exact" | "percentage" | "shares",
      values: string[],
      participants = ids.slice(0, count),
    ) =>
      saveExpense(ids[payer], id, {
        description,
        amount,
        date,
        paidBy: ids[payer],
        splitType,
        inputs: participants.map((userId, i) => ({
          userId,
          value: values[i] ?? "1",
        })),
      });
    if (count === 3) {
      await add("November rent", "24000", "2026-11-01", 1, "equal", []);
      await add(
        "Groceries & a little extra",
        "1840.50",
        "2026-11-02",
        0,
        "exact",
        ["700", "600", "540.50"],
      );
      await add(
        "Internet, keeping us connected",
        "1500",
        "2026-11-03",
        2,
        "percentage",
        ["50", "30", "20"],
      );
      await add("Friday dinner at home", "1260", "2026-11-03", 0, "shares", [
        "2",
        "1",
        "1",
      ]);
      await settle(ids[0], id, {
        fromId: ids[0],
        toId: ids[1],
        amount: "1000",
        method: "bKash",
        requestId: randomUUID(),
      });
    } else {
      await add(
        "A room with a sea view",
        "12000",
        "2026-10-24",
        0,
        "equal",
        [],
      );
      await add("Seafood by the shore", "3200", "2026-10-25", 1, "shares", [
        "2",
        "1",
        "1",
        "1",
      ]);
      await add(
        "Coffee before the bus",
        "450",
        "2026-10-26",
        2,
        "equal",
        [],
        [ids[0], ids[2], ids[3]],
      );
    }
  }
  console.log(
    "Seed ready: rafi, nusrat, tanvir, mahi @fairshare.demo / FairShareDemo!2026",
  );
} finally {
  await pool.end();
}
