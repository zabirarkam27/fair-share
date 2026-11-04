import { settlements } from "./server";
import { SettlementPanel } from "./settlement-panel";
import { SettlementPlanError } from "./engine";
import { BalanceInvariantError } from "@/features/balances/engine";
import { GroupError } from "@/features/groups/service";
export async function SettlementSection({ groupId }: { groupId: string }) {
  let data;
  try {
    data = await settlements.suggestions({ groupId });
  } catch (error) {
    if (
      error instanceof SettlementPlanError ||
      error instanceof BalanceInvariantError ||
      (error instanceof GroupError && error.code === "CONFLICT")
    )
      return (
        <section role="alert" className="mt-8 rounded-xl border p-5">
          <h2 className="font-medium">Payment suggestions unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof SettlementPlanError
              ? error.message
              : "Review the group’s financial records before recording a payment."}
          </p>
        </section>
      );
    throw error;
  }
  return <SettlementPanel data={data} />;
}
