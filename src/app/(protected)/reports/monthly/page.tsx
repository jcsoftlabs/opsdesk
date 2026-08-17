import Link from "next/link";
import Decimal from "decimal.js";
import { requireRoleOrRedirect, requireBureauId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getReferenceRateAt } from "@/lib/referenceRate";
import { computeReportMetrics } from "@/lib/reportMetrics";
import { MonthlyReportExport } from "./MonthlyReportExport";

export const dynamic = "force-dynamic";

const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseMonthParam(value: string | undefined): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function toMonthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireRoleOrRedirect(["SUPERVISOR", "ADMIN"]);
  const bureauId = requireBureauId(user);
  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonthParam(monthParam);

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);

  const [transactions, referenceRate, closedSessions] = await Promise.all([
    prisma.transaction.findMany({
      where: { bureauId, createdAt: { gte: monthStart, lt: monthEnd } },
      include: { createdBy: { select: { id: true, fullName: true } } },
    }),
    getReferenceRateAt(user.organizationId, monthEnd),
    prisma.cashSession.findMany({
      where: { bureauId, status: "CLOSED", closedAt: { gte: monthStart, lt: monthEnd } },
    }),
  ]);

  const byCashier = new Map<string, { fullName: string; rows: typeof transactions }>();
  for (const t of transactions) {
    const entry = byCashier.get(t.createdById);
    if (entry) entry.rows.push(t);
    else byCashier.set(t.createdById, { fullName: t.createdBy.fullName, rows: [t] });
  }

  const perCashier = Array.from(byCashier.entries()).map(([cashierId, { fullName, rows }]) => {
    const metrics = computeReportMetrics(
      rows.map((t) => ({
        channel: t.channel,
        receivedCurrency: t.receivedCurrency,
        payoutCurrency: t.payoutCurrency,
        amountReceived: new Decimal(t.amountReceived.toString()),
        feeAmount: new Decimal(t.feeAmount.toString()),
        netPayout: new Decimal(t.netPayout.toString()),
        exchangeRateApplied: t.exchangeRateApplied ? new Decimal(t.exchangeRateApplied.toString()) : null,
        status: t.status,
      })),
      referenceRate,
    );
    return { cashierId, fullName, metrics };
  });

  const varianceTotals = closedSessions.reduce(
    (acc, s) => ({
      usd: acc.usd.plus(s.varianceUsd?.toString() ?? "0"),
      htg: acc.htg.plus(s.varianceHtg?.toString() ?? "0"),
    }),
    { usd: new Decimal(0), htg: new Decimal(0) },
  );

  const exportRows = perCashier.map((c) => ({
    cashier: c.fullName,
    transactionCount: c.metrics.transactionCount,
    totalFeesUsd: c.metrics.totalFeesByCurrency.find((f) => f.currency === "USD")?.total.toString() ?? "0",
    totalFeesHtg: c.metrics.totalFeesByCurrency.find((f) => f.currency === "HTG")?.total.toString() ?? "0",
    exchangeMarginHtg: c.metrics.exchangeMarginHtg?.toString() ?? "",
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Rapport mensuel par caissier</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/reports" className="text-neutral-600 underline">
            Voir le rapport journalier
          </Link>
          <Link href="/reports/weekly" className="text-neutral-600 underline">
            Voir le rapport hebdomadaire
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={`/reports/monthly?month=${toMonthParam(prevMonth.getFullYear(), prevMonth.getMonth())}`}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          ← Mois précédent
        </Link>
        <span className="text-sm font-medium text-neutral-900">{toMonthParam(year, month)}</span>
        <Link
          href={`/reports/monthly?month=${toMonthParam(nextMonth.getFullYear(), nextMonth.getMonth())}`}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          Mois suivant →
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Caissier</th>
              <th className="px-4 py-2">Nb transactions</th>
              <th className="px-4 py-2">Frais USD</th>
              <th className="px-4 py-2">Frais HTG</th>
              <th className="px-4 py-2">Marge de change (HTG)</th>
            </tr>
          </thead>
          <tbody>
            {perCashier.map((c) => (
              <tr key={c.cashierId} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-900">{c.fullName}</td>
                <td className="px-4 py-2 text-neutral-700">{c.metrics.transactionCount}</td>
                <td className="px-4 py-2 text-neutral-700">
                  {AMOUNT_FORMATTER.format(
                    c.metrics.totalFeesByCurrency.find((f) => f.currency === "USD")?.total.toNumber() ?? 0,
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-700">
                  {AMOUNT_FORMATTER.format(
                    c.metrics.totalFeesByCurrency.find((f) => f.currency === "HTG")?.total.toNumber() ?? 0,
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-700">
                  {c.metrics.exchangeMarginHtg ? AMOUNT_FORMATTER.format(c.metrics.exchangeMarginHtg.toNumber()) : "—"}
                </td>
              </tr>
            ))}
            {perCashier.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  Aucune transaction ce mois-ci.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-xs text-neutral-500">
          Écarts de caisse du mois (caisse commune, sessions clôturées — pas par caissier, voir §7.6)
        </p>
        <p className="mt-1 font-mono text-sm text-neutral-900">
          {AMOUNT_FORMATTER.format(varianceTotals.usd.toNumber())} USD /{" "}
          {AMOUNT_FORMATTER.format(varianceTotals.htg.toNumber())} HTG
        </p>
      </div>

      <MonthlyReportExport month={toMonthParam(year, month)} rows={exportRows} />
    </main>
  );
}
