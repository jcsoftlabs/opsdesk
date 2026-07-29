"use client";

import { ExportButton } from "@/components/ExportButton";

interface ExportRow {
  cashier: string;
  transactionCount: number;
  totalFeesUsd: string;
  totalFeesHtg: string;
  exchangeMarginHtg: string;
}

export function MonthlyReportExport({ month, rows }: { month: string; rows: ExportRow[] }) {
  return (
    <div>
      <ExportButton
        filename={`rapport-mensuel-${month}`}
        rows={rows}
        columns={[
          { header: "Caissier", value: (r) => r.cashier },
          { header: "Nb transactions", value: (r) => r.transactionCount },
          { header: "Frais USD", value: (r) => r.totalFeesUsd },
          { header: "Frais HTG", value: (r) => r.totalFeesHtg },
          { header: "Marge de change (HTG)", value: (r) => r.exchangeMarginHtg },
        ]}
      />
    </div>
  );
}
