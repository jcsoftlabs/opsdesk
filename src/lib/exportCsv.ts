/**
 * Export CSV côté client, sans dépendance externe. Excel ouvre nativement
 * le CSV — c'est ce que le cahier demande ("Export Excel de toute liste
 * affichée"), sans le risque de sécurité des libs de génération .xlsx
 * (vulnérabilités connues dans xlsx/exceljs, non justifiées ici).
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[";\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  const lines = [
    columns.map((c) => escapeCsvField(c.header)).join(";"),
    ...rows.map((row) => columns.map((c) => escapeCsvField(c.value(row))).join(";")),
  ];
  // BOM UTF-8 pour qu'Excel affiche correctement les accents français.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
