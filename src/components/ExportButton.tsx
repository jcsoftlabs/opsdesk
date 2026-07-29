"use client";

import { exportToCsv, type CsvColumn } from "@/lib/exportCsv";

interface ExportButtonProps<T> {
  filename: string;
  columns: CsvColumn<T>[];
  rows: T[];
  label?: string;
}

export function ExportButton<T>({ filename, columns, rows, label = "Exporter en Excel" }: ExportButtonProps<T>) {
  return (
    <button
      type="button"
      onClick={() => exportToCsv(filename, columns, rows)}
      className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
    >
      {label}
    </button>
  );
}
