"use server";

import { revalidatePath } from "next/cache";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAuth";
import { recordPlatformAuditLog } from "@/lib/platformAudit";
import { generateTemporaryPassword } from "@/lib/password";

export interface CreatePlatformAdminState {
  error?: string;
  createdEmail?: string;
  temporaryPassword?: string;
}

export async function createPlatformAdminAction(
  _prevState: CreatePlatformAdminState,
  formData: FormData,
): Promise<CreatePlatformAdminState> {
  const platformAdmin = await requirePlatformAdmin();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!fullName || !email) return { error: "Nom complet et e-mail requis" };

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });

  try {
    const created = await prisma.platformAdmin.create({
      data: { fullName, email, passwordHash, mustChangePassword: true },
    });

    await recordPlatformAuditLog({
      platformAdminId: platformAdmin.id,
      action: "PLATFORM_ADMIN_CREATED",
      entityType: "PlatformAdmin",
      entityId: created.id,
      afterJson: { fullName, email },
    });

    revalidatePath("/platform/team");
    return { createdEmail: created.email, temporaryPassword };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return { error: "Cette adresse e-mail existe déjà" };
    }
    throw error;
  }
}

export interface ToggleAdminActiveState {
  error?: string;
}

export async function togglePlatformAdminActiveAction(
  _prevState: ToggleAdminActiveState,
  formData: FormData,
): Promise<ToggleAdminActiveState> {
  const platformAdmin = await requirePlatformAdmin();

  const targetId = String(formData.get("platformAdminId") ?? "");
  if (targetId === platformAdmin.id) {
    return { error: "Vous ne pouvez pas désactiver votre propre compte" };
  }

  const target = await prisma.platformAdmin.findUnique({ where: { id: targetId } });
  if (!target) return { error: "Compte introuvable" };

  await prisma.platformAdmin.update({ where: { id: targetId }, data: { active: !target.active } });

  await recordPlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: target.active ? "PLATFORM_ADMIN_DEACTIVATED" : "PLATFORM_ADMIN_REACTIVATED",
    entityType: "PlatformAdmin",
    entityId: targetId,
    beforeJson: { active: target.active },
    afterJson: { active: !target.active },
  });

  revalidatePath("/platform/team");
  return {};
}

export interface ResetAdminPasswordState {
  error?: string;
  temporaryPassword?: string;
}

export async function resetPlatformAdminPasswordAction(
  _prevState: ResetAdminPasswordState,
  formData: FormData,
): Promise<ResetAdminPasswordState> {
  const platformAdmin = await requirePlatformAdmin();

  const targetId = String(formData.get("platformAdminId") ?? "");
  const target = await prisma.platformAdmin.findUnique({ where: { id: targetId } });
  if (!target) return { error: "Compte introuvable" };

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });

  await prisma.platformAdmin.update({
    where: { id: targetId },
    data: { passwordHash, mustChangePassword: true },
  });

  await recordPlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: "PLATFORM_ADMIN_PASSWORD_RESET",
    entityType: "PlatformAdmin",
    entityId: targetId,
  });

  revalidatePath("/platform/team");
  return { temporaryPassword };
}
