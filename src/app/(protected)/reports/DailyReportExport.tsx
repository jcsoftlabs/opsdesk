"use client";

import { ExportButton } from "@/components/ExportButton";

interface ExportRow {
  receiptNo: string;
  channel: string;
  client: string;
  amountReceived: string;
  receivedCurrency: string;
  feeAmount: string;
  netPayout: string;
  payoutCurrency: string;
  status: string;
  createdBy: string;
}

export function DailyReportExport({ date, rows }: { date: string; rows: ExportRow[] }) {
  return (
    <div>
      <ExportButton
        filename={`rapport-journalier-${date}`}
        rows={rows}
        columns={[
          { header: "Reçu", value: (r) => r.receiptNo },
          { header: "Canal", value: (r) => r.channel },
          { header: "Bénéficiaire", value: (r) => r.client },
          { header: "Montant reçu", value: (r) => r.amountReceived },
          { header: "Devise reçue", value: (r) => r.receivedCurrency },
          { header: "Frais", value: (r) => r.feeAmount },
          { header: "Montant remis", value: (r) => r.netPayout },
          { header: "Devise remise", value: (r) => r.payoutCurrency },
          { header: "Statut", value: (r) => r.status },
          { header: "Agent", value: (r) => r.createdBy },
        ]}
      />
    </div>
  );
}
