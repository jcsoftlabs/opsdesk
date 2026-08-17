import "server-only";
import { prisma } from "@/lib/db";

interface RecordPlatformAuditLogInput {
  platformAdminId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
}

/** platform_audit_logs est append-only (imposé aussi en base). */
export async function recordPlatformAuditLog(input: RecordPlatformAuditLogInput): Promise<void> {
  await prisma.platformAuditLog.create({
    data: {
      platformAdminId: input.platformAdminId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.beforeJson === undefined ? undefined : (input.beforeJson as object),
      afterJson: input.afterJson === undefined ? undefined : (input.afterJson as object),
    },
  });
}
