"use client";

import { ExportButton } from "@/components/ExportButton";

interface MobileMoneyExportRow {
  date: string;
  provider: string;
  operationType: string;
  clientNumber: string;
  destinataireNumber: string;
  amount: string;
  createdBy: string;
}

export function MobileMoneyExport({ filename, rows }: { filename: string; rows: MobileMoneyExportRow[] }) {
  return (
    <ExportButton
      filename={filename}
      rows={rows}
      columns={[
        { header: "Date/heure", value: (r) => r.date },
        { header: "Réseau", value: (r) => r.provider },
        { header: "Type", value: (r) => r.operationType },
        { header: "N° client", value: (r) => r.clientNumber },
        { header: "N° destinataire", value: (r) => r.destinataireNumber },
        { header: "Montant (HTG)", value: (r) => r.amount },
        { header: "Agent", value: (r) => r.createdBy },
      ]}
    />
  );
}
