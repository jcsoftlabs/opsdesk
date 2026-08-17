-- Révision (2026-08-16) : les opérations MonCash/NatCash affectent bien la
-- caisse commune (dépôt/transfert = cash qui rentre, retrait = cash qui
-- sort). Seul le gain de l'agent (contrat Digicel/Natcom) reste hors du
-- champ d'OpsDesk.

ALTER TYPE "CashMovementReason" ADD VALUE IF NOT EXISTS 'MOBILE_MONEY_DEPOSIT';
ALTER TYPE "CashMovementReason" ADD VALUE IF NOT EXISTS 'MOBILE_MONEY_TRANSFER';
ALTER TYPE "CashMovementReason" ADD VALUE IF NOT EXISTS 'MOBILE_MONEY_WITHDRAWAL';

-- Table encore vide à ce stade (fonctionnalité livrée le même jour) :
-- colonne NOT NULL ajoutable directement, pas de backfill nécessaire.
ALTER TABLE "mobile_money_operations" ADD COLUMN "cashSessionId" TEXT NOT NULL;

ALTER TABLE "mobile_money_operations" ADD CONSTRAINT "mobile_money_operations_cashSessionId_fkey"
  FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "mobile_money_operations_cashSessionId_idx" ON "mobile_money_operations"("cashSessionId");

ALTER TABLE "cash_movements" ADD COLUMN "mobileMoneyOperationId" TEXT;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_mobileMoneyOperationId_fkey"
  FOREIGN KEY ("mobileMoneyOperationId") REFERENCES "mobile_money_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cash_movements_mobileMoneyOperationId_idx" ON "cash_movements"("mobileMoneyOperationId");
