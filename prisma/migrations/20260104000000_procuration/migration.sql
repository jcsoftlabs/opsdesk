-- Procuration (confirmé 2026-07-28) : la personne qui retire l'argent peut
-- différer du bénéficiaire visé. Renseigné au paiement.

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "collectedById" TEXT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_collectedById_fkey"
  FOREIGN KEY ("collectedById") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "transactions_collectedById_idx" ON "transactions"("collectedById");
