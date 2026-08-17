-- Conversion en SaaS multi-bureaux (confirmé 2026-08-16) : un propriétaire
-- (Organization) peut avoir plusieurs bureaux (Bureau), chacun avec sa
-- propre caisse commune. Kmat Supply devient le premier tenant : toutes les
-- données existantes sont rattachées à une Organization "Kmat Supply" et un
-- unique Bureau "Kmat Supply — Siège" (M8, IMPLEMENTATION.md §15).
--
-- Tous les utilisateurs existants (admin, superviseur, caissier) sont
-- rattachés à ce bureau unique : le comportement de l'application ne change
-- pas dans cette passe (un seul bureau = comportement identique
-- à aujourd'hui), le sweep de scoping des écrans vient dans une passe
-- ultérieure (M9).

CREATE TYPE "InvoiceStatus" AS ENUM ('DUE', 'PAID');

CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "billingRatePerBureau" DECIMAL(18,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bureaux" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bureaux_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bureaux_organizationId_idx" ON "bureaux"("organizationId");
ALTER TABLE "bureaux" ADD CONSTRAINT "bureaux_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "bureauCount" INTEGER NOT NULL,
    "ratePerBureau" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DUE',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "invoices_organizationId_status_idx" ON "invoices"("organizationId", "status");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "platform_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Colonnes de scoping, nullable pour l'instant (backfill juste après).
ALTER TABLE "users" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "users" ADD COLUMN "bureauId" TEXT;
ALTER TABLE "clients" ADD COLUMN "bureauId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "bureauId" TEXT;
ALTER TABLE "attachments" ADD COLUMN "bureauId" TEXT;
ALTER TABLE "cash_sessions" ADD COLUMN "bureauId" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "bureauId" TEXT;
ALTER TABLE "mobile_money_operations" ADD COLUMN "bureauId" TEXT;
ALTER TABLE "pricing_rules" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "reference_rates" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "organizationId" TEXT;

-- Création du tenant Kmat Supply et backfill de toutes les lignes existantes.
-- audit_logs et mobile_money_operations sont append-only (trigger dédié,
-- cf. migrations précédentes) : on désactive les triggers le temps du
-- backfill de scoping, puis on les réactive immédiatement — la seule
-- exception jamais faite à l'append-only, réservée à cette migration unique.
ALTER TABLE "audit_logs" DISABLE TRIGGER "audit_logs_no_update";
ALTER TABLE "mobile_money_operations" DISABLE TRIGGER "mobile_money_operations_no_update";

DO $$
DECLARE
  v_org_id TEXT := 'org_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24);
  v_bureau_id TEXT := 'bureau_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24);
BEGIN
  INSERT INTO "organizations" ("id", "name", "phone", "billingRatePerBureau", "active", "createdAt")
  VALUES (v_org_id, 'Kmat Supply', '+509 34 40 3636 / 36 00 1818', 0, true, now());

  INSERT INTO "bureaux" ("id", "organizationId", "name", "active", "createdAt")
  VALUES (v_bureau_id, v_org_id, 'Kmat Supply — Siège', true, now());

  UPDATE "users" SET "organizationId" = v_org_id, "bureauId" = v_bureau_id;
  UPDATE "clients" SET "bureauId" = v_bureau_id;
  UPDATE "transactions" SET "bureauId" = v_bureau_id;
  UPDATE "attachments" SET "bureauId" = v_bureau_id;
  UPDATE "cash_sessions" SET "bureauId" = v_bureau_id;
  UPDATE "cash_movements" SET "bureauId" = v_bureau_id;
  UPDATE "mobile_money_operations" SET "bureauId" = v_bureau_id;
  UPDATE "pricing_rules" SET "organizationId" = v_org_id;
  UPDATE "reference_rates" SET "organizationId" = v_org_id;
  UPDATE "audit_logs" SET "organizationId" = v_org_id;
END $$;

ALTER TABLE "audit_logs" ENABLE TRIGGER "audit_logs_no_update";
ALTER TABLE "mobile_money_operations" ENABLE TRIGGER "mobile_money_operations_no_update";

-- organizationId/bureauId obligatoires désormais que le backfill est fait.
ALTER TABLE "users" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "bureauId" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "bureauId" SET NOT NULL;
ALTER TABLE "attachments" ALTER COLUMN "bureauId" SET NOT NULL;
ALTER TABLE "cash_sessions" ALTER COLUMN "bureauId" SET NOT NULL;
ALTER TABLE "cash_movements" ALTER COLUMN "bureauId" SET NOT NULL;
ALTER TABLE "mobile_money_operations" ALTER COLUMN "bureauId" SET NOT NULL;
ALTER TABLE "pricing_rules" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "reference_rates" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "organizationId" SET NOT NULL;
-- users.bureauId reste nullable (utilisateur "org-wide" si null).

-- Clés étrangères.
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_bureauId_fkey"
  FOREIGN KEY ("bureauId") REFERENCES "bureaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_bureauId_fkey"
  FOREIGN KEY ("bureauId") REFERENCES "bureaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bureauId_fkey"
  FOREIGN KEY ("bureauId") REFERENCES "bureaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_bureauId_fkey"
  FOREIGN KEY ("bureauId") REFERENCES "bureaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_bureauId_fkey"
  FOREIGN KEY ("bureauId") REFERENCES "bureaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_bureauId_fkey"
  FOREIGN KEY ("bureauId") REFERENCES "bureaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_money_operations" ADD CONSTRAINT "mobile_money_operations_bureauId_fkey"
  FOREIGN KEY ("bureauId") REFERENCES "bureaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reference_rates" ADD CONSTRAINT "reference_rates_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index de scoping.
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");
CREATE INDEX "users_bureauId_idx" ON "users"("bureauId");
CREATE INDEX "cash_movements_bureauId_idx" ON "cash_movements"("bureauId");

-- Contraintes/index existants qui doivent maintenant être scopés par bureau
-- plutôt que globaux (deux bureaux différents peuvent réutiliser les mêmes
-- numéros de pièce d'identité ou les mêmes références de canal).
DROP INDEX "clients_idType_idNumber_key";
CREATE UNIQUE INDEX "clients_bureauId_idType_idNumber_key" ON "clients"("bureauId", "idType", "idNumber");

DROP INDEX "transactions_channel_externalRef_key";
CREATE UNIQUE INDEX "transactions_bureauId_channel_externalRef_key" ON "transactions"("bureauId", "channel", "externalRef");

DROP INDEX "transactions_status_createdAt_idx";
CREATE INDEX "transactions_bureauId_status_createdAt_idx" ON "transactions"("bureauId", "status", "createdAt");

DROP INDEX "cash_sessions_status_idx";
CREATE INDEX "cash_sessions_bureauId_status_idx" ON "cash_sessions"("bureauId", "status");

DROP INDEX "pricing_rules_channel_payoutCurrency_effectiveTo_idx";
CREATE INDEX "pricing_rules_org_channel_currency_effective_idx"
  ON "pricing_rules"("organizationId", "channel", "payoutCurrency", "effectiveTo");

DROP INDEX "reference_rates_effectiveTo_idx";
CREATE INDEX "reference_rates_organizationId_effectiveTo_idx" ON "reference_rates"("organizationId", "effectiveTo");

DROP INDEX "audit_logs_userId_createdAt_idx";
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

DROP INDEX "mobile_money_operations_provider_createdAt_idx";
CREATE INDEX "mobile_money_operations_bureauId_provider_createdAt_idx"
  ON "mobile_money_operations"("bureauId", "provider", "createdAt");
