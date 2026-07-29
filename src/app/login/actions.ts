"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { LOCKOUT_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from "@/lib/password";

export interface LoginState {
  error?: string;
}

const GENERIC_ERROR = "Nom d'utilisateur ou mot de passe incorrect";

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Nom d'utilisateur et mot de passe requis" };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) {
    return { error: GENERIC_ERROR };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Compte verrouillé après plusieurs échecs. Réessayez plus tard." };
  }

  const validPassword = await argon2.verify(user.passwordHash, password);
  if (!validPassword) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
      },
    });
    if (shouldLock) {
      await recordAuditLog({
        userId: user.id,
        action: "LOGIN_LOCKED",
        entityType: "User",
        entityId: user.id,
      });
      return { error: "Compte verrouillé après plusieurs échecs. Réessayez plus tard." };
    }
    return { error: GENERIC_ERROR };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  const { token, expiresAt } = createSessionToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  await recordAuditLog({
    userId: user.id,
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: user.id,
  });

  redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  if (user) {
    await recordAuditLog({
      userId: user.id,
      action: "LOGOUT",
      entityType: "User",
      entityId: user.id,
    });
  }
  redirect("/login");
}
