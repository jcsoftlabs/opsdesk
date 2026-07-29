import { requireRoleOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NewTransactionForm, type ActiveRuleDTO } from "./NewTransactionForm";

export default async function NewTransactionPage() {
  await requireRoleOrRedirect(["CASHIER", "SUPERVISOR", "ADMIN"]);

  const rules = await prisma.pricingRule.findMany({ where: { effectiveTo: null } });
  const activeRules: ActiveRuleDTO[] = rules.map((r) => ({
    channel: r.channel,
    payoutCurrency: r.payoutCurrency,
    allowed: r.allowed,
    feePercent: r.feePercent.toString(),
    exchangeRate: r.exchangeRate?.toString() ?? null,
    feeBeforeConversion: r.feeBeforeConversion,
    roundingUnit: r.roundingUnit.toString(),
  }));

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-lg font-semibold text-neutral-900">Nouvelle transaction</h1>
      <div className="mt-6">
        <NewTransactionForm activeRules={activeRules} />
      </div>
    </main>
  );
}
