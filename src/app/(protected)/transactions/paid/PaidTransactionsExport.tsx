"use client";

import { ExportButton } from "@/components/ExportButton";

interface ExportRow {
  time: string;
  receiptNo: string;
  channel: string;
  client: string;
  netPayout: string;
  payoutCurrency: string;
  paidBy: string;
}

export function PaidTransactionsExport({ rows }: { rows: ExportRow[] }) {
  return (
    <ExportButton
      filename="transactions-payees"
      rows={rows}
      columns={[
        { header: "Heure de paiement", value: (r) => r.time },
        { header: "Reçu", value: (r) => r.receiptNo },
        { header: "Canal", value: (r) => r.channel },
        { header: "Bénéficiaire", value: (r) => r.client },
        { header: "Montant remis", value: (r) => r.netPayout },
        { header: "Devise", value: (r) => r.payoutCurrency },
        { header: "Payé par", value: (r) => r.paidBy },
      ]}
    />
  );
}
