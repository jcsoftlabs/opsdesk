-- Caisse commune : plus de caisse par caissier, une caisse partagée ouverte
-- par l'admin. Voir IMPLEMENTATION.md §7.6.

-- AlterEnum
ALTER TYPE "CashMovementReason" ADD VALUE IF NOT EXISTS 'CASH_TOPUP';

-- RenameColumn
ALTER TABLE "cash_sessions" RENAME COLUMN "userId" TO "openedById";

-- RenameIndex
DROP INDEX IF EXISTS "cash_sessions_userId_status_idx";
CREATE INDEX "cash_sessions_status_idx" ON "cash_sessions"("status");
