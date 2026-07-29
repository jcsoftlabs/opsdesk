"use client";

import { ExportButton } from "@/components/ExportButton";

interface ExportRow {
  date: string;
  user: string;
  action: string;
  entity: string;
}

export function AuditLogExport({ rows }: { rows: ExportRow[] }) {
  return (
    <ExportButton
      filename="journal-audit"
      rows={rows}
      columns={[
        { header: "Date", value: (r) => r.date },
        { header: "Utilisateur", value: (r) => r.user },
        { header: "Action", value: (r) => r.action },
        { header: "Entité", value: (r) => r.entity },
      ]}
    />
  );
}
