"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import type { MobileMoneyOperationType, MobileMoneyProvider } from "@/generated/prisma/client";

const PROVIDERS: MobileMoneyProvider[] = ["MONCASH", "NATCASH"];
const OPERATION_TYPES: MobileMoneyOperationType[] = ["RETRAIT", "DEPOT", "TRANSFERT"];

export interface CreateMobileMoneyOperationState {
  error?: string;
  success?: boolean;
}

/**
 * Registre BRH des agents MonCash/NatCash (cahier obligatoire) : juste les
 * numéros et le montant, pas de calcul de frais (fixés par le réseau, pas
 * par l'agent — confirmé 2026-08-16) et pas de mouvement de caisse OpsDesk.
 */
export async function createMobileMoneyOperationAction(
  _prevState: CreateMobileMoneyOperationState,
  formData: FormData,
): Promise<CreateMobileMoneyOperationState> {
  const user = await requireUser();

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

  const operation = await prisma.mobileMoneyOperation.create({
    data: {
      provider: provider as MobileMoneyProvider,
      operationType: operationType as MobileMoneyOperationType,
      clientNumber,
      destinataireNumber: operationType === "TRANSFERT" ? destinataireNumber : null,
      amount: amountRaw,
      createdById: user.id,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "MobileMoneyOperation",
    entityId: operation.id,
    afterJson: {
      provider: operation.provider,
      operationType: operation.operationType,
      clientNumber: operation.clientNumber,
      destinataireNumber: operation.destinataireNumber,
      amount: operation.amount.toString(),
    },
  });

  revalidatePath("/mobile-money");
  return { success: true };
}
