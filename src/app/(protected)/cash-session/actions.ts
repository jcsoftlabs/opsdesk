"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export interface OpenCashSessionState {
  error?: string;
}

export async function openCashSessionAction(
  _prevState: OpenCashSessionState,
  formData: FormData,
): Promise<OpenCashSessionState> {
  const user = await requireUser();

  const existing = await prisma.cashSession.findFirst({
    where: { userId: user.id, status: "OPEN" },
  });
  if (existing) return { error: "Vous avez déjà une session de caisse ouverte." };

  const openingUsdRaw = String(formData.get("openingUsd") ?? "0").trim();
  const openingHtgRaw = String(formData.get("openingHtg") ?? "0").trim();

  const openingUsd = Number(openingUsdRaw);
  const openingHtg = Number(openingHtgRaw);
  if (!Number.isFinite(openingUsd) || openingUsd < 0 || !Number.isFinite(openingHtg) || openingHtg < 0) {
    return { error: "Fonds de départ invalide" };
  }

  const session = await prisma.cashSession.create({
    data: {
      userId: user.id,
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
  return {};
}
