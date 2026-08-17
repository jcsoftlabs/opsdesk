"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireBureauId } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import type { CashMovementReason, MobileMoneyOperationType, MobileMoneyProvider } from "@/generated/prisma/client";

const PROVIDERS: MobileMoneyProvider[] = ["MONCASH", "NATCASH"];
const OPERATION_TYPES: MobileMoneyOperationType[] = ["RETRAIT", "DEPOT", "TRANSFERT"];

// Impact caisse (confirmé 2026-08-16) : dépôt et transfert font rentrer du
// cash physique (le client le remet au guichet), un retrait en fait sortir.
// Le gain de l'agent (contrat Digicel/Natcom) n'est pas suivi ici.
const CASH_DIRECTION_BY_OPERATION_TYPE: Record<MobileMoneyOperationType, "IN" | "OUT"> = {
  DEPOT: "IN",
  TRANSFERT: "IN",
  RETRAIT: "OUT",
};

const CASH_REASON_BY_OPERATION_TYPE: Record<MobileMoneyOperationType, CashMovementReason> = {
  DEPOT: "MOBILE_MONEY_DEPOSIT",
  TRANSFERT: "MOBILE_MONEY_TRANSFER",
  RETRAIT: "MOBILE_MONEY_WITHDRAWAL",
};

export interface CreateMobileMoneyOperationState {
  error?: string;
  success?: boolean;
}

/**
 * Registre BRH des agents MonCash/NatCash (cahier obligatoire) : numéros et
 * montant, pas de calcul de frais (fixés par le réseau, pas par l'agent —
 * confirmé 2026-08-16). Affecte la caisse commune comme un paiement de
 * transfert : puise dans la session ouverte au moment de la saisie.
 */
export async function createMobileMoneyOperationAction(
  _prevState: CreateMobileMoneyOperationState,
  formData: FormData,
): Promise<CreateMobileMoneyOperationState> {
  const user = await requireUser();
  const bureauId = requireBureauId(user);

  const provider = formData.get("provider") as string;
  const operationType = formData.get("operationType") as string;
  const clientNumber = (formData.get("clientNumber") as string)?.trim();
  const destinataireNumber = (formData.get("destinataireNumber") as string)?.trim() || null;
  const amountRaw = (formData.get("amount") as string)?.trim();

  if (!PROVIDERS.includes(provider as MobileMoneyProvider)) {
    return { error: "Réseau invalide." };
  }
  if (!OPERATION_TYPES.includes(operationType as MobileMoneyOperationType)) {
    return { error: "Type d'opération invalide." };
  }
  if (!clientNumber) {
    return { error: "Le numéro du client est obligatoire." };
  }
  if (operationType === "TRANSFERT" && !destinataireNumber) {
    return { error: "Le numéro du destinataire est obligatoire pour un transfert." };
  }
  if (operationType !== "TRANSFERT" && destinataireNumber) {
    return { error: "Le numéro du destinataire ne s'applique qu'aux transferts." };
  }

  const amount = Number(amountRaw);
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Montant invalide." };
  }

  // Caisse commune : comme pour le paiement d'un transfert, on puise dans la
  // session actuellement ouverte par l'admin (§7.6), pas dans une caisse
  // personnelle de l'agent qui saisit l'opération.
  const cashSession = await prisma.cashSession.findFirst({ where: { bureauId, status: "OPEN" } });
  if (!cashSession) {
    return { error: "Aucune caisse commune ouverte. Demandez à un administrateur de l'ouvrir." };
  }

  const type = operationType as MobileMoneyOperationType;

  const operation = await prisma.$transaction(async (tx) => {
    const created = await tx.mobileMoneyOperation.create({
      data: {
        bureauId,
        provider: provider as MobileMoneyProvider,
        operationType: type,
        clientNumber,
        destinataireNumber: type === "TRANSFERT" ? destinataireNumber : null,
        amount: amountRaw,
        cashSessionId: cashSession.id,
        createdById: user.id,
      },
    });

    await tx.cashMovement.create({
      data: {
        cashSessionId: cashSession.id,
        bureauId,
        direction: CASH_DIRECTION_BY_OPERATION_TYPE[type],
        currency: "HTG",
        amount: amountRaw,
        reason: CASH_REASON_BY_OPERATION_TYPE[type],
        mobileMoneyOperationId: created.id,
        createdById: user.id,
      },
    });

    return created;
  });

  await recordAuditLog({
    userId: user.id,
    organizationId: user.organizationId,
    action: "CREATE",
    entityType: "MobileMoneyOperation",
    entityId: operation.id,
    afterJson: {
      provider: operation.provider,
      operationType: operation.operationType,
      clientNumber: operation.clientNumber,
      destinataireNumber: operation.destinataireNumber,
      amount: operation.amount.toString(),
      cashSessionId: cashSession.id,
    },
  });

  revalidatePath("/mobile-money");
  revalidatePath("/cash-session");
  revalidatePath("/dashboard");
  return { success: true };
}
