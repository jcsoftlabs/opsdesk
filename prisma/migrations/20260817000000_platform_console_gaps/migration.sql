-- Combler les manques de la console plateforme (§15/M11, révision 2026-08-17) :
-- journal d'audit plateforme, gestion d'équipe (PlatformAdmin), archivage
-- d'organisation (jamais de suppression — obligations de conservation, §14).

ALTER TABLE "organizations" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "platform_admins" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "platform_admins" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "platformAdminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_audit_logs_entityType_entityId_idx" ON "platform_audit_logs"("entityType", "entityId");
CREATE INDEX "platform_audit_logs_platformAdminId_createdAt_idx" ON "platform_audit_logs"("platformAdminId", "createdAt");

ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_platformAdminId_fkey"
  FOREIGN KEY ("platformAdminId") REFERENCES "platform_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only, comme audit_logs et mobile_money_operations.
CREATE OR REPLACE FUNCTION forbid_platform_audit_log_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'platform_audit_logs est append-only : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_audit_logs_no_update
  BEFORE UPDATE ON "platform_audit_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_platform_audit_log_mutation();

CREATE TRIGGER platform_audit_logs_no_delete
  BEFORE DELETE ON "platform_audit_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_platform_audit_log_mutation();
