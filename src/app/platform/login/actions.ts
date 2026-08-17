"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { createPlatformSessionToken, PLATFORM_SESSION_COOKIE_NAME } from "@/lib/platformAuth";

export interface PlatformLoginState {
  error?: string;
}

const GENERIC_ERROR = "Adresse e-mail ou mot de passe incorrect";

export async function platformLoginAction(
  _prevState: PlatformLoginState,
  formData: FormData,
): Promise<PlatformLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "E-mail et mot de passe requis" };
  }

  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin) return { error: GENERIC_ERROR };

  const validPassword = await argon2.verify(admin.passwordHash, password);
  if (!validPassword) return { error: GENERIC_ERROR };

  const { token, expiresAt } = createPlatformSessionToken(admin.id);
  const cookieStore = await cookies();
  cookieStore.set(PLATFORM_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  redirect("/platform");
}

export async function platformLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PLATFORM_SESSION_COOKIE_NAME);
  redirect("/platform/login");
}
