CREATE TYPE "MobileMoneyProvider" AS ENUM ('MONCASH', 'NATCASH');
CREATE TYPE "MobileMoneyOperationType" AS ENUM ('RETRAIT', 'DEPOT', 'TRANSFERT');

CREATE TABLE "mobile_money_operations" (
    "id" TEXT NOT NULL,
    "provider" "MobileMoneyProvider" NOT NULL,
    "operationType" "MobileMoneyOperationType" NOT NULL,
    "clientNumber" TEXT NOT NULL,
    "destinataireNumber" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_money_operations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mobile_money_operations_provider_createdAt_idx" ON "mobile_money_operations"("provider", "createdAt");
CREATE INDEX "mobile_money_operations_clientNumber_idx" ON "mobile_money_operations"("clientNumber");

ALTER TABLE "mobile_money_operations" ADD CONSTRAINT "mobile_money_operations_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cahier BRH : append-only, comme audit_logs — un registre ne se corrige pas après coup.
CREATE TRIGGER mobile_money_operations_no_update
  BEFORE UPDATE ON "mobile_money_operations"
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();

CREATE TRIGGER mobile_money_operations_no_delete
  BEFORE DELETE ON "mobile_money_operations"
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();
