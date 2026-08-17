"use server";

import { revalidatePath } from "next/cache";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { generateTemporaryPassword } from "@/lib/password";
import type { Role } from "@/generated/prisma/client";

export interface CreateUserState {
  error?: string;
  createdUsername?: string;
  temporaryPassword?: string;
}

export async function createUserAction(
  _prevState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const admin = await requireUser();
  requireRole(admin, ["ADMIN"]);

  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;

  if (!fullName || !username) {
    return { error: "Nom complet et nom d'utilisateur requis" };
  }
  if (!["CASHIER", "SUPERVISOR", "ADMIN"].includes(role)) {
    return { error: "Rôle invalide" };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });

  try {
    const created = await prisma.user.create({
      data: {
        fullName,
        username,
        role,
        passwordHash,
        mustChangePassword: true,
        organizationId: admin.organizationId,
        bureauId: admin.bureauId,
      },
    });

    await recordAuditLog({
      userId: admin.id,
      organizationId: admin.organizationId,
      action: "USER_CREATED",
      entityType: "User",
      entityId: created.id,
      afterJson: { fullName: created.fullName, username: created.username, role: created.role },
    });

    revalidatePath("/admin/users");
    return { createdUsername: created.username, temporaryPassword };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return { error: "Ce nom d'utilisateur existe déjà" };
    }
    throw error;
  }
}

export interface SimpleActionState {
  error?: string;
  temporaryPassword?: string;
}

export async function deactivateUserAction(
  _prevState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const admin = await requireUser();
  requireRole(admin, ["ADMIN"]);

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Utilisateur manquant" };
  if (userId === admin.id) return { error: "Vous ne pouvez pas désactiver votre propre compte" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.organizationId !== admin.organizationId) {
    return { error: "Utilisateur introuvable" };
  }

  await prisma.user.update({ where: { id: userId }, data: { active: false } });

  await recordAuditLog({
    userId: admin.id,
    organizationId: admin.organizationId,
    action: "USER_DEACTIVATED",
    entityType: "User",
    entityId: userId,
    beforeJson: { active: true },
    afterJson: { active: false },
  });

  revalidatePath("/admin/users");
  return {};
}

export async function reactivateUserAction(
  _prevState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const admin = await requireUser();
  requireRole(admin, ["ADMIN"]);

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Utilisateur manquant" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.organizationId !== admin.organizationId) {
    return { error: "Utilisateur introuvable" };
  }

  await prisma.user.update({ where: { id: userId }, data: { active: true } });

  await recordAuditLog({
    userId: admin.id,
    organizationId: admin.organizationId,
    action: "USER_REACTIVATED",
    entityType: "User",
    entityId: userId,
    beforeJson: { active: false },
    afterJson: { active: true },
  });

  revalidatePath("/admin/users");
  return {};
}

export async function resetPasswordAction(
  _prevState: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const admin = await requireUser();
  requireRole(admin, ["ADMIN"]);

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Utilisateur manquant" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.organizationId !== admin.organizationId) {
    return { error: "Utilisateur introuvable" };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  await recordAuditLog({
    userId: admin.id,
    organizationId: admin.organizationId,
    action: "PASSWORD_RESET",
    entityType: "User",
    entityId: userId,
  });

  return { temporaryPassword };
}
