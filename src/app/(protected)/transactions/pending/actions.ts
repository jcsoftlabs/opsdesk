"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export interface SimpleActionState {
  error?: string;
}

export async function verifyTransactionAction(
  _prevState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const user = await requireUser();
  requireRole(user, ["CASHIER", "SUPERVISOR", "ADMIN"]);

  const transactionId = String(formData.get("transactionId") ?? "");
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction) return { error: "Transaction introuvable" };
  if (transaction.status !== "RECEIVED") {
    return { error: "Cette transaction n'est plus en attente de vérification." };
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: "VERIFIED", verifiedById: user.id, verifiedAt: new Date() },
  });

  await recordAuditLog({
    userId: user.id,
    action: "TRANSACTION_VERIFIED",
    entityType: "Transaction",
    entityId: transactionId,
  });

  revalidatePath("/transactions/pending");
  return {};
}

export async function payTransactionAction(
  _prevState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const user = await requireUser();
  requireRole(user, ["CASHIER", "SUPERVISOR", "ADMIN"]);

  const transactionId = String(formData.get("transactionId") ?? "");
  const confirmedNetPayout = String(formData.get("confirmedNetPayout") ?? "");

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction) return { error: "Transaction introuvable" };
  if (transaction.status !== "VERIFIED") {
    return { error: "Cette transaction doit être vérifiée avant le paiement." };
  }
  if (confirmedNetPayout !== transaction.netPayout.toString()) {
    return { error: "Le montant confirmé ne correspond pas au montant à remettre. Rechargez la page." };
  }

  // Caisse commune : le paiement puise dans la caisse partagée actuellement
  // ouverte par l'admin, pas dans une caisse personnelle de l'agent qui paie.
  const cashSession = await prisma.cashSession.findFirst({ where: { status: "OPEN" } });
  if (!cashSession) {
    return { error: "Aucune caisse commune ouverte. Demandez à un administrateur de l'ouvrir." };
  }

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "PAID",
        paidById: user.id,
        paidAt: new Date(),
        cashSessionId: cashSession.id,
      },
    }),
    prisma.cashMovement.create({
      data: {
        cashSessionId: cashSession.id,
        direction: "OUT",
        currency: transaction.payoutCurrency,
        amount: transaction.netPayout,
        reason: "TRANSFER_PAYOUT",
        transactionId,
        createdById: user.id,
      },
    }),
  ]);

  await recordAuditLog({
    userId: user.id,
    action: "TRANSACTION_PAID",
    entityType: "Transaction",
    entityId: transactionId,
    afterJson: { netPayout: transaction.netPayout.toString(), payoutCurrency: transaction.payoutCurrency },
  });

  revalidatePath("/transactions/pending");
  revalidatePath("/dashboard");
  return {};
}
