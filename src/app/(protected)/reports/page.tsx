import Link from "next/link";
import Decimal from "decimal.js";
import { requireRoleOrRedirect, requireBureauId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getReferenceRateAt } from "@/lib/referenceRate";
import { computeReportMetrics } from "@/lib/reportMetrics";
import { addDays, parseDateParam as parseDateParamOrNull, startOfDay, toDateParam } from "@/lib/businessWeek";
import { DailyReportExport } from "./DailyReportExport";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};

const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseDateParam(value: string | undefined): Date {
  return parseDateParamOrNull(value) ?? startOfDay(new Date());
}

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireRoleOrRedirect(["SUPERVISOR", "ADMIN"]);
  const bureauId = await requireBureauId(user);
  const { date: dateParam } = await searchParams;

  const day = parseDateParam(dateParam);
  const dayStart = day;
  const dayEnd = addDays(day, 1);
  const prevDay = addDays(day, -1);
  const nextDay = addDays(day, 1);

  const [transactions, closedSessions, referenceRate] = await Promise.all([
    prisma.transaction.findMany({
      where: { bureauId, createdAt: { gte: dayStart, lt: dayEnd } },
      include: { createdBy: { select: { fullName: true } }, client: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cashSession.findMany({
      where: { bureauId, status: "CLOSED", closedAt: { gte: dayStart, lt: dayEnd } },
    }),
    getReferenceRateAt(user.organizationId, dayEnd),
  ]);

  const metrics = computeReportMetrics(
    transactions.map((t) => ({
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

  const varianceTotals = closedSessions.reduce(
    (acc, s) => ({
      usd: acc.usd.plus(s.varianceUsd?.toString() ?? "0"),
      htg: acc.htg.plus(s.varianceHtg?.toString() ?? "0"),
    }),
    { usd: new Decimal(0), htg: new Decimal(0) },
  );

  const exportRows = transactions.map((t) => ({
    receiptNo: t.receiptNo,
    channel: CHANNEL_LABEL[t.channel] ?? t.channel,
    client: t.client.fullName,
    amountReceived: t.amountReceived.toString(),
    receivedCurrency: t.receivedCurrency,
    feeAmount: t.feeAmount.toString(),
    netPayout: t.netPayout.toString(),
    payoutCurrency: t.payoutCurrency,
    status: t.status,
    createdBy: t.createdBy.fullName,
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Rapport journalier</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/reports/weekly" className="text-neutral-600 underline">
            Voir le rapport hebdomadaire
          </Link>
          <Link href="/reports/monthly" className="text-neutral-600 underline">
            Voir le rapport mensuel
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={`/reports?date=${toDateParam(prevDay)}`}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          ← Veille
        </Link>
        <span className="text-sm font-medium text-neutral-900">{toDateParam(day)}</span>
        <Link
          href={`/reports?date=${toDateParam(nextDay)}`}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          Lendemain →
        </Link>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Volume par canal et par devise</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-1">Canal</th>
              <th className="py-1">Devise reçue</th>
              <th className="py-1">Nb</th>
              <th className="py-1">Montant reçu</th>
            </tr>
          </thead>
          <tbody>
            {metrics.volumeByChannel.map((row) => (
              <tr key={`${row.channel}-${row.currency}`} className="border-b border-neutral-100 last:border-0">
                <td className="py-1 text-neutral-700">{CHANNEL_LABEL[row.channel] ?? row.channel}</td>
                <td className="py-1 text-neutral-700">{row.currency}</td>
                <td className="py-1 text-neutral-700">{row.count}</td>
                <td className="py-1 text-neutral-900">{AMOUNT_FORMATTER.format(row.amountReceived.toNumber())}</td>
              </tr>
            ))}
            {metrics.volumeByChannel.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-neutral-400">
                  Aucune transaction ce jour-là.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Total des frais encaissés</p>
          {metrics.totalFeesByCurrency.length === 0 ? (
            <p className="mt-1 text-sm text-neutral-400">—</p>
          ) : (
            metrics.totalFeesByCurrency.map((f) => (
              <p key={f.currency} className="mt-1 font-mono text-lg text-neutral-900">
                {AMOUNT_FORMATTER.format(f.total.toNumber())} {f.currency}
              </p>
            ))
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Marge de change (HTG)</p>
          <p className="mt-1 font-mono text-lg text-neutral-900">
            {metrics.exchangeMarginHtg ? AMOUNT_FORMATTER.format(metrics.exchangeMarginHtg.toNumber()) : "—"}
          </p>
          {!metrics.exchangeMarginHtg ? (
            <p className="mt-1 text-xs text-neutral-400">Taux de référence non renseigné pour cette date.</p>
          ) : null}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Écarts de caisse (sessions clôturées ce jour)</p>
          <p className="mt-1 font-mono text-sm text-neutral-900">
            {AMOUNT_FORMATTER.format(varianceTotals.usd.toNumber())} USD /{" "}
            {AMOUNT_FORMATTER.format(varianceTotals.htg.toNumber())} HTG
          </p>
        </div>
      </section>

      <DailyReportExport date={toDateParam(day)} rows={exportRows} />
    </main>
  );
}
