import "server-only";
import { prisma } from "@/lib/db";

interface RecordAuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
}

/** audit_logs est append-only (imposé aussi en base, cf. migration dédiée). */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.beforeJson === undefined ? undefined : (input.beforeJson as object),
      afterJson: input.afterJson === undefined ? undefined : (input.afterJson as object),
    },
  });
}
