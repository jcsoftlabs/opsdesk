-- audit_logs est append-only : aucune UPDATE ni DELETE, imposé en base
-- indépendamment des droits accordés au rôle applicatif (défense en profondeur).
CREATE OR REPLACE FUNCTION forbid_audit_log_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs est append-only : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();
