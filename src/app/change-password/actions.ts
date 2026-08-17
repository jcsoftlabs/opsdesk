"use server";

import { redirect } from "next/navigation";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export interface ChangePasswordState {
  error?: string;
}

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Les deux mots de passe ne correspondent pas" };
  }

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const validCurrent = await argon2.verify(dbUser.passwordHash, currentPassword);
  if (!validCurrent) {
    return { error: "Mot de passe actuel incorrect" };
  }

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await recordAuditLog({
    userId: user.id,
    organizationId: user.organizationId,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
  });

  redirect("/dashboard");
}
