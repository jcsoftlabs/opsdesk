"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAuth";
import { recordPlatformAuditLog } from "@/lib/platformAudit";
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
  const platformAdmin = await requirePlatformAdmin();

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

  await recordPlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: "ORGANIZATION_CREATED",
    entityType: "Organization",
    entityId: organizationId,
    afterJson: { name, phone: phone || null, billingRatePerBureau, bureauName, adminUsername },
  });

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
  const platformAdmin = await requirePlatformAdmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return { error: "Organisation introuvable" };

  await prisma.organization.update({ where: { id: organizationId }, data: { active: !organization.active } });

  await recordPlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: organization.active ? "ORGANIZATION_SUSPENDED" : "ORGANIZATION_REACTIVATED",
    entityType: "Organization",
    entityId: organizationId,
    beforeJson: { active: organization.active },
    afterJson: { active: !organization.active },
  });

  revalidatePath("/platform");
  revalidatePath(`/platform/organizations/${organizationId}`);
  return {};
}

export interface ArchiveOrganizationState {
  error?: string;
}

/**
 * "Client parti" (§15, révision 2026-08-17) : jamais de suppression, les
 * données financières sont conservées (§14). L'archivage retire seulement
 * l'organisation de la liste active de la console — l'accès tenant reste
 * régi par `active` (suspension), indépendant de l'archivage.
 */
export async function archiveOrganizationAction(
  _prevState: ArchiveOrganizationState,
  formData: FormData,
): Promise<ArchiveOrganizationState> {
  const platformAdmin = await requirePlatformAdmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return { error: "Organisation introuvable" };

  await prisma.organization.update({ where: { id: organizationId }, data: { archived: !organization.archived } });

  await recordPlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: organization.archived ? "ORGANIZATION_UNARCHIVED" : "ORGANIZATION_ARCHIVED",
    entityType: "Organization",
    entityId: organizationId,
    beforeJson: { archived: organization.archived },
    afterJson: { archived: !organization.archived },
  });

  revalidatePath("/platform");
  revalidatePath(`/platform/organizations/${organizationId}`);
  return {};
}

export interface UpdateOrganizationInfoState {
  error?: string;
}

export async function updateOrganizationInfoAction(
  _prevState: UpdateOrganizationInfoState,
  formData: FormData,
): Promise<UpdateOrganizationInfoState> {
  const platformAdmin = await requirePlatformAdmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { error: "Nom requis" };

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return { error: "Organisation introuvable" };

  await prisma.organization.update({
    where: { id: organizationId },
    data: { name, phone: phone || null },
  });

  await recordPlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: "ORGANIZATION_INFO_UPDATED",
    entityType: "Organization",
    entityId: organizationId,
    beforeJson: { name: organization.name, phone: organization.phone },
    afterJson: { name, phone: phone || null },
  });

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
  const platformAdmin = await requirePlatformAdmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const rateRaw = String(formData.get("billingRatePerBureau") ?? "").trim();
  const rate = Number(rateRaw);
  if (!rateRaw || !Number.isFinite(rate) || rate < 0) return { error: "Tarif invalide" };

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return { error: "Organisation introuvable" };

  await prisma.organization.update({ where: { id: organizationId }, data: { billingRatePerBureau: rateRaw } });

  await recordPlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: "ORGANIZATION_RATE_UPDATED",
    entityType: "Organization",
    entityId: organizationId,
    beforeJson: { billingRatePerBureau: organization.billingRatePerBureau.toString() },
    afterJson: { billingRatePerBureau: rateRaw },
  });

  revalidatePath(`/platform/organizations/${organizationId}`);
  return {};
}

export interface ToggleBureauActiveState {
  error?: string;
}

/** Suspendre un seul bureau d'une organisation multi-bureaux (§15, révision 2026-08-17). */
export async function togglePlatformBureauActiveAction(
  _prevState: ToggleBureauActiveState,
  formData: FormData,
): Promise<ToggleBureauActiveState> {
  const platformAdmin = await requirePlatformAdmin();

  const bureauId = String(formData.get("bureauId") ?? "");
  const bureau = await prisma.bureau.findUnique({ where: { id: bureauId } });
  if (!bureau) return { error: "Bureau introuvable" };

  await prisma.bureau.update({ where: { id: bureauId }, data: { active: !bureau.active } });

  await recordPlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: bureau.active ? "BUREAU_SUSPENDED" : "BUREAU_REACTIVATED",
    entityType: "Bureau",
    entityId: bureauId,
    beforeJson: { active: bureau.active },
    afterJson: { active: !bureau.active },
  });

  revalidatePath(`/platform/organizations/${bureau.organizationId}`);
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

  const invoice = await prisma.invoice.create({
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

  await recordPlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: "INVOICE_GENERATED",
    entityType: "Invoice",
    entityId: invoice.id,
    afterJson: { organizationId, bureauCount, totalAmount: totalAmount.toString(), periodStartRaw, periodEndRaw },
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
  const platformAdmin = await requirePlatformAdmin();

  const invoiceId = String(formData.get("invoiceId") ?? "");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { error: "Facture introuvable" };

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: new Date() },
  });

  await recordPlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: "INVOICE_MARKED_PAID",
    entityType: "Invoice",
    entityId: invoiceId,
    afterJson: { totalAmount: invoice.totalAmount.toString() },
  });

  revalidatePath(`/platform/organizations/${invoice.organizationId}`);
  return {};
}
