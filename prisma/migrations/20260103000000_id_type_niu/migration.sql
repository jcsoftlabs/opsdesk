-- IdType : CIN remplacé par NIU (confirmé par le client, 2026-07-28).
-- Postgres ne permet pas de retirer une valeur d'enum directement : on
-- recrée le type et on migre les données existantes (CIN -> NIU).

ALTER TYPE "IdType" RENAME TO "IdType_old";

CREATE TYPE "IdType" AS ENUM ('NIF', 'NIU', 'PASSPORT', 'PERMIS', 'AUTRE');

ALTER TABLE "clients"
  ALTER COLUMN "idType" TYPE "IdType"
  USING (
    CASE "idType"::text
      WHEN 'CIN' THEN 'NIU'
      ELSE "idType"::text
    END
  )::"IdType";

DROP TYPE "IdType_old";
