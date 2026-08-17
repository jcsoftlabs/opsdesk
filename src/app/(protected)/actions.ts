"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, ACTIVE_BUREAU_COOKIE_NAME } from "@/lib/auth";

/**
 * Sélecteur de bureau actif (§15/M10) : réservé aux utilisateurs org-wide
 * (bureauId = null sur leur compte). Un utilisateur rattaché à un seul
 * bureau ne peut jamais en changer — inutile même d'exposer l'action.
 */
export async function setActiveBureauAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.bureauId) return;

  const bureauId = String(formData.get("bureauId") ?? "").trim();
  const cookieStore = await cookies();

  if (!bureauId) {
    cookieStore.delete(ACTIVE_BUREAU_COOKIE_NAME);
    redirect("/dashboard");
  }

  const bureau = await prisma.bureau.findUnique({ where: { id: bureauId } });
  if (!bureau || bureau.organizationId !== user.organizationId) {
    redirect("/dashboard");
  }

  cookieStore.set(ACTIVE_BUREAU_COOKIE_NAME, bureauId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/dashboard");
}
