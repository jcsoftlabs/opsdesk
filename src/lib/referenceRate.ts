import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";

/** Le taux de référence marché en vigueur à une date donnée (versionné comme PricingRule). */
export async function getReferenceRateAt(organizationId: string, date: Date): Promise<Decimal | null> {
  const row = await prisma.referenceRate.findFirst({
    where: {
      organizationId,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: date } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  return row ? new Decimal(row.rate.toString()) : null;
}
