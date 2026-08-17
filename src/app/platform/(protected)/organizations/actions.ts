"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAuth";
import { generateTemporaryPassword } from "@/lib/password";
import { parseDateParam } from "@/lib/businessWeek";

export interface CreateOrganizationState {
  error?: string;
}

/**
 * Crée une Organization avec son premier Bureau et son premier compte ADMIN
 * (org-wide, bureauId = null au départ — l'ADMIN choisira son bureau actif
 * dès la première connexion via le sélecteur de la sidebar, §15/M10).
 */
export async function createOrganizationAction(
  _prevState: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  await requirePlatformAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const billingRatePerBureau = String(formData.get("billingRatePerBureau") ?? "").trim();
  const bureauName = String(formData.get("bureauName") ?? "").trim();
  const adminFullName = String(formData.get("adminFullName") ?? "").trim();
  const adminUsername = String(formData.get("adminUsername") ?? "").trim();

  if (!name || !bureauName || !adminFullName || !adminUsername) {
    return { error: "Nom de l'organisation, du premier bureau, et de l'administrateur requis" };
  }
  const rate = Number(billingRatePerBureau);
  if (!billingRatePerBureau || !Number.isFinite(rate) || rate < 0) {
    return { error: "Tarif par bureau invalide" };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });

  let organizationId: string;
  try {
    organizationId = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name, phone: phone || null, billingRatePerBureau },
      });
      const bureau = await tx.bureau.create({
        data: { organizationId: organization.id, name: bureauName },
      });
      await tx.user.create({
        data: {
          fullName: adminFullName,
          username: adminUsername,
          passwordHash,
          role: "ADMIN",
          mustChangePassword: true,
          organizationId: organization.id,
          bureauId: bureau.id,
        },
      });
      return organization.id;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return { error: "Ce nom d'utilisateur existe déjà" };
    }
    throw error;
  }

  revalidatePath("/platform");
  redirect(`/platform/organizations/${organizationId}?created=1&username=${adminUsername}&password=${temporaryPassword}`);
}

export interface ToggleOrganizationState {
  error?: string;
}

export async function toggleOrganizationActiveAction(
  _prevState: ToggleOrganizationState,
  formData: FormData,
): Promise<ToggleOrganizationState> {
  await requirePlatformAdmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return { error: "Organisation introuvable" };

  await prisma.organization.update({ where: { id: organizationId }, data: { active: !organization.active } });

  revalidatePath("/platform");
  revalidatePath(`/platform/organizations/${organizationId}`);
  return {};
}

export interface UpdateBillingRateState {
  error?: string;
}

export async function updateBillingRateAction(
  _prevState: UpdateBillingRateState,
  formData: FormData,
): Promise<UpdateBillingRateState> {
  await requirePlatformAdmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const rateRaw = String(formData.get("billingRatePerBureau") ?? "").trim();
  const rate = Number(rateRaw);
  if (!rateRaw || !Number.isFinite(rate) || rate < 0) return { error: "Tarif invalide" };

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return { error: "Organisation introuvable" };

  await prisma.organization.update({ where: { id: organizationId }, data: { billingRatePerBureau: rateRaw } });

  revalidatePath(`/platform/organizations/${organizationId}`);
  return {};
}

export interface GenerateInvoiceState {
  error?: string;
}

/** Facture manuelle (§15/M11) : nombre de bureaux actifs × tarif, pour une période donnée. */
export async function generateInvoiceAction(
  _prevState: GenerateInvoiceState,
  formData: FormData,
): Promise<GenerateInvoiceState> {
  const platformAdmin = await requirePlatformAdmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const periodStartRaw = String(formData.get("periodStart") ?? "");
  const periodEndRaw = String(formData.get("periodEnd") ?? "");
  // parseDateParam construit un Date local (année/mois/jour), pas un Date
  // UTC minuit — "2026-08-01" affiché en fr-FR ne doit jamais glisser au 31/07.
  const periodStart = parseDateParam(periodStartRaw);
  const periodEnd = parseDateParam(periodEndRaw);
  if (!periodStart || !periodEnd) return { error: "Période requise" };

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return { error: "Organisation introuvable" };

  const bureauCount = await prisma.bureau.count({ where: { organizationId, active: true } });
  const totalAmount = Number(organization.billingRatePerBureau) * bureauCount;

  await prisma.invoice.create({
    data: {
      organizationId,
      periodStart,
      periodEnd,
      bureauCount,
      ratePerBureau: organization.billingRatePerBureau,
      totalAmount: totalAmount.toString(),
      createdById: platformAdmin.id,
    },
  });

  revalidatePath(`/platform/organizations/${organizationId}`);
  return {};
}

export interface MarkInvoicePaidState {
  error?: string;
}

export async function markInvoicePaidAction(
  _prevState: MarkInvoicePaidState,
  formData: FormData,
): Promise<MarkInvoicePaidState> {
  await requirePlatformAdmin();

  const invoiceId = String(formData.get("invoiceId") ?? "");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { error: "Facture introuvable" };

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: new Date() },
  });

  revalidatePath(`/platform/organizations/${invoice.organizationId}`);
  return {};
}
