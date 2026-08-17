"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export interface CreateBureauState {
  error?: string;
}

export async function createBureauAction(
  _prevState: CreateBureauState,
  formData: FormData,
): Promise<CreateBureauState> {
  const admin = await requireUser();
  requireRole(admin, ["ADMIN"]);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nom du bureau requis" };

  const bureau = await prisma.bureau.create({
    data: { organizationId: admin.organizationId, name },
  });

  await recordAuditLog({
    userId: admin.id,
    organizationId: admin.organizationId,
    action: "BUREAU_CREATED",
    entityType: "Bureau",
    entityId: bureau.id,
    afterJson: { name: bureau.name },
  });

  revalidatePath("/admin/bureaux");
  revalidatePath("/admin/users");
  return {};
}

export interface DeactivateBureauState {
  error?: string;
}

export async function deactivateBureauAction(
  _prevState: DeactivateBureauState,
  formData: FormData,
): Promise<DeactivateBureauState> {
  const admin = await requireUser();
  requireRole(admin, ["ADMIN"]);

  const bureauId = String(formData.get("bureauId") ?? "");
  const bureau = await prisma.bureau.findUnique({ where: { id: bureauId } });
  if (!bureau || bureau.organizationId !== admin.organizationId) {
    return { error: "Bureau introuvable" };
  }

  await prisma.bureau.update({ where: { id: bureauId }, data: { active: !bureau.active } });

  await recordAuditLog({
    userId: admin.id,
    organizationId: admin.organizationId,
    action: bureau.active ? "BUREAU_DEACTIVATED" : "BUREAU_REACTIVATED",
    entityType: "Bureau",
    entityId: bureauId,
  });

  revalidatePath("/admin/bureaux");
  return {};
}
