"use client";

import { ExportButton } from "@/components/ExportButton";

interface ExportRow {
  time: string;
  receiptNo: string;
  channel: string;
  client: string;
  netPayout: string;
  payoutCurrency: string;
  status: string;
}

export function DashboardExport({ rows }: { rows: ExportRow[] }) {
  return (
    <ExportButton
      filename="transactions-du-jour"
      rows={rows}
      columns={[
        { header: "Heure", value: (r) => r.time },
        { header: "Reçu", value: (r) => r.receiptNo },
        { header: "Canal", value: (r) => r.channel },
        { header: "Bénéficiaire", value: (r) => r.client },
        { header: "Montant remis", value: (r) => r.netPayout },
        { header: "Devise", value: (r) => r.payoutCurrency },
        { header: "Statut", value: (r) => r.status },
      ]}
    />
  );
}
