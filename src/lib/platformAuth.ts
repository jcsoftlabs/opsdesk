// Auth de la console plateforme (§15/M11), entièrement séparée de l'auth
// tenant : cookie distinct, table distincte (PlatformAdmin, jamais User),
// pour qu'une session plateforme ne puisse jamais être confondue avec une
// session tenant — frontière de sécurité importante pour un système financier.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSessionToken, verifySessionToken } from "@/lib/session";

export const PLATFORM_SESSION_COOKIE_NAME = "opsdesk_platform_session";

export interface CurrentPlatformAdmin {
  id: string;
  fullName: string;
  email: string;
  mustChangePassword: boolean;
}

export async function getCurrentPlatformAdmin(): Promise<CurrentPlatformAdmin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLATFORM_SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;

  const admin = await prisma.platformAdmin.findUnique({ where: { id: session.userId } });
  // Un compte plateforme désactivé perd l'accès immédiatement, même avec un cookie encore valide.
  if (!admin || !admin.active) return null;

  return {
    id: admin.id,
    fullName: admin.fullName,
    email: admin.email,
    mustChangePassword: admin.mustChangePassword,
  };
}

export async function requirePlatformAdmin(): Promise<CurrentPlatformAdmin> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) throw new Error("Authentification plateforme requise");
  return admin;
}

export async function requirePlatformAdminOrRedirect(): Promise<CurrentPlatformAdmin> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) redirect("/platform/login");
  if (admin.mustChangePassword) redirect("/platform/change-password");
  return admin;
}

export { createSessionToken as createPlatformSessionToken };
