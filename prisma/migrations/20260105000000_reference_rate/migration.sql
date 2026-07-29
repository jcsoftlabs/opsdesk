-- Taux de référence marché (§7.8), saisi par l'admin, utilisé pour calculer
-- la marge de change dans les rapports.

CREATE TABLE "reference_rates" (
    "id" TEXT NOT NULL,
    "rate" DECIMAL(10,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reference_rates_effectiveTo_idx" ON "reference_rates"("effectiveTo");

ALTER TABLE "reference_rates" ADD CONSTRAINT "reference_rates_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
