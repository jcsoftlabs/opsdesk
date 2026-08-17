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
  organizationId: string;
  // null = utilisateur "org-wide" (le propriétaire ou un admin qui gère
  // plusieurs bureaux) : gère les bureaux/utilisateurs/grille tarifaire de
  // son Organization mais n'ouvre pas personnellement de caisse, une caisse
  // appartenant à un bureau précis. Défini = utilisateur rattaché à un seul
  // bureau (confirmé 2026-08-16).
  bureauId: string | null;
}

/** Résout l'utilisateur courant à partir du cookie de session. Ne redirige jamais. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { organization: { select: { active: true } } },
  });
  // Un compte désactivé, ou une organisation suspendue (facture impayée,
  // §15/M11), perd l'accès immédiatement, même avec un cookie encore valide.
  if (!user || !user.active || !user.organization.active) return null;

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    organizationId: user.organizationId,
    bureauId: user.bureauId,
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

export class NoBureauSelectedError extends Error {
  constructor() {
    super(
      "Aucun bureau sélectionné. Un utilisateur multi-bureaux doit choisir un bureau actif avant cette action.",
    );
    this.name = "NoBureauSelectedError";
  }
}

export const ACTIVE_BUREAU_COOKIE_NAME = "opsdesk_active_bureau";

/**
 * Résout le bureau dans lequel agit l'utilisateur courant : le sien s'il est
 * rattaché à un seul bureau (prioritaire, un utilisateur de bureau ne choisit
 * jamais). Sinon (utilisateur org-wide, `bureauId = null`) : `explicitBureauId`
 * s'il est fourni (ex. `?bureauId=` du tableau de bord), sinon le bureau actif
 * mémorisé dans le cookie `opsdesk_active_bureau` (posé par le sélecteur de
 * bureau de la sidebar, §15/M10). Sans aucune des deux, lève — un utilisateur
 * org-wide doit explicitement choisir un bureau avant d'agir dessus.
 */
export async function requireBureauId(user: CurrentUser, explicitBureauId?: string | null): Promise<string> {
  if (user.bureauId) return user.bureauId;
  if (explicitBureauId) return explicitBureauId;

  const cookieStore = await cookies();
  const active = cookieStore.get(ACTIVE_BUREAU_COOKIE_NAME)?.value;
  if (active) return active;

  throw new NoBureauSelectedError();
}
