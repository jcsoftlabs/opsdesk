"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, requireBureauId } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  createUploadSignature,
  verifyUploadedResource,
  type UploadSignature,
  type VerifiedResource,
} from "@/lib/cloudinary";
import {
  calculatePricing,
  PricingNotAllowedError,
  PricingValidationError,
  RECEIVED_CURRENCY_BY_CHANNEL,
  CHANNEL_REF_PREFIX,
  type Channel,
  type Currency,
} from "@/lib/pricing";
import type { IdType } from "@/generated/prisma/client";

const CREATE_TRANSACTION_ROLES = ["CASHIER", "SUPERVISOR", "ADMIN"] as const;

export async function getUploadSignatureAction(): Promise<UploadSignature> {
  await requireUser();
  return createUploadSignature();
}

export interface ClientSearchResult {
  id: string;
  fullName: string;
  idType: IdType;
  idNumber: string;
  phone: string | null;
}

export async function searchClientsAction(query: string): Promise<ClientSearchResult[]> {
  const user = await requireUser();
  const bureauId = await requireBureauId(user);
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return prisma.client.findMany({
    where: {
      bureauId,
      OR: [
        { fullName: { contains: trimmed, mode: "insensitive" } },
        { idNumber: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: { id: true, fullName: true, idType: true, idNumber: true, phone: true },
    take: 10,
    orderBy: { fullName: "asc" },
  });
}

/**
 * Un même expéditeur envoie souvent à répétition au même bénéficiaire. Pas de
 * table Sender séparée (un expéditeur à l'étranger n'a pas d'identifiant fiable
 * pour dédupliquer) : on suggère simplement les noms déjà utilisés pour ce
 * client, tirés de l'historique des transactions.
 */
export async function getRecentSendersForClientAction(clientId: string): Promise<string[]> {
  const user = await requireUser();
  const bureauId = await requireBureauId(user);
  if (!clientId) return [];

  const rows = await prisma.transaction.findMany({
    where: { clientId, bureauId },
    distinct: ["senderName"],
    select: { senderName: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return rows.map((r) => r.senderName);
}

export interface CreateTransactionState {
  error?: string;
  success?: { transactionId: string; receiptNo: string };
}

/**
 * Référence générée par le système, jamais saisie à la main (confirmé
 * 2026-07-28) : le numéro de confirmation réel Zelle/CashApp n'apparaît pas
 * toujours dans les captures d'écran. Une séquence Postgres partagée
 * garantit l'unicité ; le préfixe identifie le canal.
 */
async function generateExternalRef(channel: Channel): Promise<string> {
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('external_ref_seq') AS nextval`;
  const seq = rows[0].nextval.toString().padStart(6, "0");
  return `${CHANNEL_REF_PREFIX[channel]}-${seq}`;
}

interface AttachmentInput {
  publicId: string;
  kind: "PAYMENT_SCREENSHOT" | "ID_DOCUMENT" | "OTHER";
}

function parseAttachments(raw: string | null): AttachmentInput[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is AttachmentInput =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as AttachmentInput).publicId === "string" &&
      ["PAYMENT_SCREENSHOT", "ID_DOCUMENT", "OTHER"].includes((item as AttachmentInput).kind),
  );
}

export async function createTransactionAction(
  _prevState: CreateTransactionState,
  formData: FormData,
): Promise<CreateTransactionState> {
  const user = await requireUser();
  requireRole(user, [...CREATE_TRANSACTION_ROLES]);
  const bureauId = await requireBureauId(user);

  const channel = String(formData.get("channel") ?? "") as Channel;
  const senderName = String(formData.get("senderName") ?? "").trim();
  const amountReceivedRaw = String(formData.get("amountReceived") ?? "").trim();
  const payoutCurrency = String(formData.get("payoutCurrency") ?? "") as Currency;

  if (!["ZELLE", "CASHAPP", "DEPOSIT_USD", "TRANSFER_HTG"].includes(channel)) {
    return { error: "Canal invalide" };
  }
  if (!senderName) return { error: "Nom de l'expéditeur requis" };
  if (!amountReceivedRaw || Number.isNaN(Number(amountReceivedRaw))) {
    return { error: "Montant reçu invalide" };
  }
  if (!["USD", "HTG"].includes(payoutCurrency)) {
    return { error: "Devise de remise invalide" };
  }

  // Bénéficiaire : client existant ou nouveau
  const existingClientId = String(formData.get("clientId") ?? "").trim();
  let clientId: string;

  if (existingClientId) {
    const client = await prisma.client.findUnique({ where: { id: existingClientId } });
    if (!client || client.bureauId !== bureauId) return { error: "Bénéficiaire introuvable" };
    clientId = client.id;
  } else {
    const clientFullName = String(formData.get("clientFullName") ?? "").trim();
    const clientIdType = String(formData.get("clientIdType") ?? "") as IdType;
    const clientIdNumber = String(formData.get("clientIdNumber") ?? "").trim();
    const clientPhone = String(formData.get("clientPhone") ?? "").trim();

    if (!clientFullName || !clientIdType || !clientIdNumber) {
      return { error: "Nom, type et numéro de pièce du bénéficiaire requis" };
    }

    const existing = await prisma.client.findUnique({
      where: { bureauId_idType_idNumber: { bureauId, idType: clientIdType, idNumber: clientIdNumber } },
    });

    if (existing) {
      clientId = existing.id;
    } else {
      const created = await prisma.client.create({
        data: {
          bureauId,
          fullName: clientFullName,
          idType: clientIdType,
          idNumber: clientIdNumber,
          phone: clientPhone || null,
          createdById: user.id,
        },
      });
      clientId = created.id;
    }
  }

  // Règle tarifaire active — recalcul autoritaire, jamais depuis le client (§7.3)
  const rule = await prisma.pricingRule.findFirst({
    where: { organizationId: user.organizationId, channel, payoutCurrency, effectiveTo: null },
  });
  if (!rule) {
    return { error: "Aucune règle tarifaire active pour cette combinaison. Contactez un administrateur." };
  }

  let pricing;
  try {
    pricing = calculatePricing(
      {
        channel,
        payoutCurrency,
        allowed: rule.allowed,
        feePercent: rule.feePercent.toString(),
        exchangeRate: rule.exchangeRate?.toString() ?? null,
        feeBeforeConversion: rule.feeBeforeConversion,
        roundingUnit: rule.roundingUnit.toString(),
      },
      amountReceivedRaw,
    );
  } catch (error) {
    if (error instanceof PricingNotAllowedError) {
      return { error: "Ce canal ne peut pas être remis dans cette devise (virement en gourdes : remise en gourdes uniquement)." };
    }
    if (error instanceof PricingValidationError) {
      return { error: error.message };
    }
    throw error;
  }

  const attachmentInputs = parseAttachments(String(formData.get("attachments") ?? ""));
  const verifiedAttachments: (VerifiedResource & { kind: AttachmentInput["kind"] })[] = [];
  for (const input of attachmentInputs) {
    try {
      const resource = await verifyUploadedResource(input.publicId);
      verifiedAttachments.push({ ...resource, kind: input.kind });
    } catch {
      return { error: "Une pièce jointe n'a pas pu être vérifiée. Réessayez l'envoi." };
    }
  }

  const externalRef = await generateExternalRef(channel);

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          bureauId,
          channel,
          externalRef,
          senderName,
          clientId,
          amountReceived: amountReceivedRaw,
          receivedCurrency: RECEIVED_CURRENCY_BY_CHANNEL[channel],
          payoutCurrency,
          feePercentApplied: pricing.feePercentApplied.toString(),
          exchangeRateApplied: pricing.exchangeRateApplied?.toString() ?? null,
          feeAmount: pricing.feeAmount.toString(),
          netPayout: pricing.netPayout.toString(),
          createdById: user.id,
          attachments: {
            create: verifiedAttachments.map((a) => ({
              bureauId,
              kind: a.kind,
              publicId: a.publicId,
              secureUrl: a.secureUrl,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              uploadedById: user.id,
            })),
          },
        },
      });
      return created;
    });

    await recordAuditLog({
      userId: user.id,
      organizationId: user.organizationId,
      action: "TRANSACTION_CREATED",
      entityType: "Transaction",
      entityId: transaction.id,
      afterJson: {
        channel,
        payoutCurrency,
        amountReceived: amountReceivedRaw,
        netPayout: pricing.netPayout.toString(),
      },
    });

    revalidatePath("/dashboard");
    return { success: { transactionId: transaction.id, receiptNo: transaction.receiptNo } };
  } catch (error) {
    // La référence est générée par une séquence : une collision serait un bug,
    // pas un vrai doublon. On demande de réessayer plutôt que d'inventer un message.
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return { error: "Conflit inattendu sur la référence générée. Réessayez." };
    }
    throw error;
  }
}
