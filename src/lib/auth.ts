// Résolution de l'utilisateur courant + garde-fous de rôle.
// Rappel du cahier (§6) : les permissions sont vérifiées côté serveur dans
// chaque Server Action. Masquer un bouton dans l'UI n'est jamais un contrôle d'accès.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import type { Role } from "@/generated/prisma/client";

export interface CurrentUser {
  id: string;
  fullName: string;
  username: string;
  role: Role;
  mustChangePassword: boolean;
}

/** Résout l'utilisateur courant à partir du cookie de session. Ne redirige jamais. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  // Un compte désactivé perd l'accès immédiatement, même avec un cookie encore valide.
  if (!user || !user.active) return null;

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Authentification requise");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Action non autorisée pour ce rôle");
    this.name = "ForbiddenError";
  }
}

/** À utiliser dans les Server Actions : lève une erreur, ne redirige jamais. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/** À utiliser dans les Server Actions, après requireUser(). */
export function requireRole(user: CurrentUser, allowed: Role[]): void {
  if (!allowed.includes(user.role)) throw new ForbiddenError();
}

/** À utiliser en tête des Server Components de page : redirige plutôt que de lever. */
export async function requireUserOrRedirect(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

/** À utiliser en tête des pages réservées à certains rôles. */
export async function requireRoleOrRedirect(allowed: Role[]): Promise<CurrentUser> {
  const user = await requireUserOrRedirect();
  if (!allowed.includes(user.role)) redirect("/dashboard");
  return user;
}
