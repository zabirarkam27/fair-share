import type { groupDetail, overview } from "./service";
// JSON transport uses ISO strings for dates.
type Json<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
export type Group = Json<Awaited<ReturnType<typeof groupDetail>>>;
export type Overview = Awaited<ReturnType<typeof overview>>;
export type Expense = Group["expenses"][number];
