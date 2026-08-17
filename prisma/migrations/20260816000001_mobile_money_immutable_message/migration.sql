-- La fonction forbid_audit_log_mutation() portait un message d'erreur
-- trompeur une fois réutilisée pour mobile_money_operations. Trigger dédié
-- avec un message correct, même sémantique (append-only, défense en profondeur).
CREATE OR REPLACE FUNCTION forbid_mobile_money_operation_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'mobile_money_operations est append-only (cahier BRH) : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mobile_money_operations_no_update ON "mobile_money_operations";
DROP TRIGGER IF EXISTS mobile_money_operations_no_delete ON "mobile_money_operations";

CREATE TRIGGER mobile_money_operations_no_update
  BEFORE UPDATE ON "mobile_money_operations"
  FOR EACH ROW EXECUTE FUNCTION forbid_mobile_money_operation_mutation();

CREATE TRIGGER mobile_money_operations_no_delete
  BEFORE DELETE ON "mobile_money_operations"
  FOR EACH ROW EXECUTE FUNCTION forbid_mobile_money_operation_mutation();
