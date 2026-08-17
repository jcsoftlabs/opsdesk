"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { calculatePricing, PricingValidationError, type Channel, type Currency } from "@/lib/pricing";

export interface UpdatePricingRuleState {
  error?: string;
}

export async function updatePricingRuleAction(
  _prevState: UpdatePricingRuleState,
  formData: FormData,
): Promise<UpdatePricingRuleState> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);

  const channel = String(formData.get("channel") ?? "") as Channel;
  const payoutCurrency = String(formData.get("payoutCurrency") ?? "") as Currency;
  const allowed = formData.get("allowed") === "on";
  const feePercentRaw = String(formData.get("feePercent") ?? "").trim();
  const exchangeRateRaw = String(formData.get("exchangeRate") ?? "").trim();
  const feeBeforeConversion = formData.get("feeBeforeConversion") === "on";
  const roundingUnitRaw = String(formData.get("roundingUnit") ?? "1").trim();

  if (!["ZELLE", "CASHAPP", "DEPOSIT_USD", "TRANSFER_HTG"].includes(channel)) {
    return { error: "Canal invalide" };
  }
  if (!["USD", "HTG"].includes(payoutCurrency)) {
    return { error: "Devise invalide" };
  }

  const current = await prisma.pricingRule.findFirst({
    where: { organizationId: user.organizationId, channel, payoutCurrency, effectiveTo: null },
  });
  if (!current) return { error: "Règle active introuvable" };

  // Le garde-fou contre une faute de frappe (§7.7) : le calcul doit réussir
  // sur un montant test avant toute validation.
  if (allowed) {
    try {
      calculatePricing(
        {
          channel,
          payoutCurrency,
          allowed,
          feePercent: feePercentRaw,
          exchangeRate: exchangeRateRaw || null,
          feeBeforeConversion,
          roundingUnit: roundingUnitRaw,
        },
        500,
      );
    } catch (error) {
      if (error instanceof PricingValidationError) return { error: error.message };
      throw error;
    }
  }

  const before = {
    allowed: current.allowed,
    feePercent: current.feePercent.toString(),
    exchangeRate: current.exchangeRate?.toString() ?? null,
    feeBeforeConversion: current.feeBeforeConversion,
    roundingUnit: current.roundingUnit.toString(),
  };
  const after = {
    allowed,
    feePercent: feePercentRaw,
    exchangeRate: exchangeRateRaw || null,
    feeBeforeConversion,
    roundingUnit: roundingUnitRaw,
  };

  const newRule = await prisma.$transaction(async (tx) => {
    await tx.pricingRule.update({ where: { id: current.id }, data: { effectiveTo: new Date() } });
    return tx.pricingRule.create({
      data: {
        organizationId: user.organizationId,
        channel,
        payoutCurrency,
        allowed,
        feePercent: feePercentRaw,
        exchangeRate: exchangeRateRaw || null,
        feeBeforeConversion,
        roundingUnit: roundingUnitRaw,
        createdById: user.id,
      },
    });
  });

  await recordAuditLog({
    userId: user.id,
    organizationId: user.organizationId,
    action: "PRICING_RULE_CHANGED",
    entityType: "PricingRule",
    entityId: newRule.id,
    beforeJson: { channel, payoutCurrency, ...before },
    afterJson: { channel, payoutCurrency, ...after },
  });

  revalidatePath("/admin/pricing");
  return {};
}

export interface UpdateReferenceRateState {
  error?: string;
}

export async function updateReferenceRateAction(
  _prevState: UpdateReferenceRateState,
  formData: FormData,
): Promise<UpdateReferenceRateState> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);

  const rateRaw = String(formData.get("rate") ?? "").trim();
  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate <= 0) return { error: "Taux invalide" };

  const current = await prisma.referenceRate.findFirst({
    where: { organizationId: user.organizationId, effectiveTo: null },
  });

  await prisma.$transaction(async (tx) => {
    if (current) {
      await tx.referenceRate.update({ where: { id: current.id }, data: { effectiveTo: new Date() } });
    }
    await tx.referenceRate.create({
      data: { organizationId: user.organizationId, rate: rateRaw, createdById: user.id },
    });
  });

  await recordAuditLog({
    userId: user.id,
    organizationId: user.organizationId,
    action: "REFERENCE_RATE_CHANGED",
    entityType: "ReferenceRate",
    entityId: "current",
    beforeJson: current ? { rate: current.rate.toString() } : null,
    afterJson: { rate: rateRaw },
  });

  revalidatePath("/admin/pricing");
  revalidatePath("/reports");
  return {};
}
