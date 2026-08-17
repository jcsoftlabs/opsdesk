import { requireRoleOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PricingRuleRow, type PricingRuleDTO } from "./PricingRuleRow";
import { ReferenceRateForm } from "./ReferenceRateForm";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const user = await requireRoleOrRedirect(["ADMIN"]);

  const [rules, referenceRate] = await Promise.all([
    prisma.pricingRule.findMany({
      where: { organizationId: user.organizationId, effectiveTo: null },
      orderBy: [{ channel: "asc" }, { payoutCurrency: "asc" }],
    }),
    prisma.referenceRate.findFirst({ where: { organizationId: user.organizationId, effectiveTo: null } }),
  ]);

  const ruleDtos: PricingRuleDTO[] = rules.map((r) => ({
    channel: r.channel,
    payoutCurrency: r.payoutCurrency,
    allowed: r.allowed,
    feePercent: r.feePercent.toString(),
    exchangeRate: r.exchangeRate?.toString() ?? null,
    feeBeforeConversion: r.feeBeforeConversion,
    roundingUnit: r.roundingUnit.toString(),
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <h1 className="text-lg font-semibold text-neutral-900">Grille tarifaire</h1>

      <ReferenceRateForm currentRate={referenceRate?.rate.toString() ?? null} />

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Canal</th>
              <th className="px-4 py-2">Devise remise</th>
              <th className="px-4 py-2">Frais</th>
              <th className="px-4 py-2">Taux</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {ruleDtos.map((rule) => (
              <PricingRuleRow key={`${rule.channel}-${rule.payoutCurrency}`} rule={rule} />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
