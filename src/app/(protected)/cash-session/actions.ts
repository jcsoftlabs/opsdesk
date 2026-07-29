"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

// Caisse commune : les agents qui traitent les transactions ne gèrent pas leur
// propre caisse. Seul l'ADMIN ouvre/ferme la caisse partagée et enregistre les
// apports de liquidités (livraison de cash). Voir IMPLEMENTATION.md §7.6.

export interface OpenCashSessionState {
  error?: string;
}

export async function openCashSessionAction(
  _prevState: OpenCashSessionState,
  formData: FormData,
): Promise<OpenCashSessionState> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);

  const existing = await prisma.cashSession.findFirst({ where: { status: "OPEN" } });
  if (existing) return { error: "Une caisse commune est déjà ouverte." };

  const openingUsdRaw = String(formData.get("openingUsd") ?? "0").trim();
  const openingHtgRaw = String(formData.get("openingHtg") ?? "0").trim();

  const openingUsd = Number(openingUsdRaw);
  const openingHtg = Number(openingHtgRaw);
  if (!Number.isFinite(openingUsd) || openingUsd < 0 || !Number.isFinite(openingHtg) || openingHtg < 0) {
    return { error: "Fonds de départ invalide" };
  }

  const session = await prisma.cashSession.create({
    data: {
      openedById: user.id,
      openingUsd: openingUsdRaw,
      openingHtg: openingHtgRaw,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "CASH_SESSION_OPENED",
    entityType: "CashSession",
    entityId: session.id,
    afterJson: { openingUsd: openingUsdRaw, openingHtg: openingHtgRaw },
  });

  revalidatePath("/dashboard");
  revalidatePath("/transactions/pending");
  revalidatePath("/cash-session");
  return {};
}

export interface ExpectedTotals {
  expectedUsd: Decimal;
  expectedHtg: Decimal;
}

/**
 * Solde théorique = fonds de départ + mouvements de la session (IN − OUT), par devise.
 * L'ouverture n'est volontairement pas dupliquée en CashMovement : openingUsd/openingHtg
 * sur CashSession en sont déjà la source de vérité.
 */
export async function computeExpectedTotals(cashSessionId: string): Promise<ExpectedTotals> {
  const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: cashSessionId } });
  const movements = await prisma.cashMovement.findMany({ where: { cashSessionId } });

  let expectedUsd = new Decimal(session.openingUsd.toString());
  let expectedHtg = new Decimal(session.openingHtg.toString());

  for (const movement of movements) {
    const amount = new Decimal(movement.amount.toString());
    const signed = movement.direction === "IN" ? amount : amount.negated();
    if (movement.currency === "USD") expectedUsd = expectedUsd.plus(signed);
    else expectedHtg = expectedHtg.plus(signed);
  }

  return { expectedUsd, expectedHtg };
}

export interface CloseCashSessionState {
  error?: string;
}

export async function closeCashSessionAction(
  _prevState: CloseCashSessionState,
  formData: FormData,
): Promise<CloseCashSessionState> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);

  const cashSessionId = String(formData.get("cashSessionId") ?? "");
  const session = await prisma.cashSession.findUnique({ where: { id: cashSessionId } });
  if (!session) return { error: "Session de caisse introuvable" };
  if (session.status !== "OPEN") return { error: "Cette session est déjà clôturée" };

  const countedUsdRaw = String(formData.get("countedUsd") ?? "").trim();
  const countedHtgRaw = String(formData.get("countedHtg") ?? "").trim();
  const varianceNote = String(formData.get("varianceNote") ?? "").trim();

  const countedUsd = Number(countedUsdRaw);
  const countedHtg = Number(countedHtgRaw);
  if (!Number.isFinite(countedUsd) || countedUsd < 0 || !Number.isFinite(countedHtg) || countedHtg < 0) {
    return { error: "Montant compté invalide" };
  }

  const { expectedUsd, expectedHtg } = await computeExpectedTotals(cashSessionId);
  const varianceUsd = new Decimal(countedUsdRaw).minus(expectedUsd);
  const varianceHtg = new Decimal(countedHtgRaw).minus(expectedHtg);

  if ((!varianceUsd.isZero() || !varianceHtg.isZero()) && !varianceNote) {
    return { error: "Un écart a été détecté : une note est obligatoire." };
  }

  await prisma.cashSession.update({
    where: { id: cashSessionId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      expectedUsd: expectedUsd.toString(),
      expectedHtg: expectedHtg.toString(),
      countedUsd: countedUsdRaw,
      countedHtg: countedHtgRaw,
      varianceUsd: varianceUsd.toString(),
      varianceHtg: varianceHtg.toString(),
      varianceNote: varianceNote || null,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "CASH_SESSION_CLOSED",
    entityType: "CashSession",
    entityId: cashSessionId,
    afterJson: {
      expectedUsd: expectedUsd.toString(),
      expectedHtg: expectedHtg.toString(),
      countedUsd: countedUsdRaw,
      countedHtg: countedHtgRaw,
      varianceUsd: varianceUsd.toString(),
      varianceHtg: varianceHtg.toString(),
    },
  });

  revalidatePath("/cash-session");
  revalidatePath("/dashboard");
  revalidatePath("/transactions/pending");
  return {};
}

export interface AddTopUpState {
  error?: string;
}

/** Apport de liquidités en cours de journée (livraison de cash par un livreur). */
export async function addCashTopUpAction(
  _prevState: AddTopUpState,
  formData: FormData,
): Promise<AddTopUpState> {
  const user = await requireUser();
  requireRole(user, ["ADMIN"]);

  const currency = String(formData.get("currency") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!["USD", "HTG"].includes(currency)) return { error: "Devise invalide" };
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Montant invalide" };

  const session = await prisma.cashSession.findFirst({ where: { status: "OPEN" } });
  if (!session) return { error: "Aucune caisse commune ouverte." };

  await prisma.cashMovement.create({
    data: {
      cashSessionId: session.id,
      direction: "IN",
      currency: currency as "USD" | "HTG",
      amount: amountRaw,
      reason: "CASH_TOPUP",
      note: note || null,
      createdById: user.id,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "CASH_TOPUP_ADDED",
    entityType: "CashSession",
    entityId: session.id,
    afterJson: { currency, amount: amountRaw, note },
  });

  revalidatePath("/cash-session");
  return {};
}
