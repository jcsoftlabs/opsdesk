import Link from "next/link";
import Decimal from "decimal.js";
import { requireUserOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeExpectedTotals } from "@/app/(protected)/cash-session/actions";
import type { TransactionStatus } from "@/generated/prisma/client";
import { DashboardExport } from "./DashboardExport";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<TransactionStatus, string> = {
  RECEIVED: "Reçue",
  VERIFIED: "Vérifiée",
  PAID: "Payée",
  CANCELLED: "Annulée",
};

const STATUS_BADGE: Record<TransactionStatus, string> = {
  RECEIVED: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  CANCELLED: "bg-neutral-200 text-neutral-600",
};

const CHANNEL_LABEL: Record<string, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", hour12: true });
const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function sumByCurrency(
  rows: { amount: Decimal; currency: "USD" | "HTG" }[],
): { usd: Decimal; htg: Decimal } {
  return rows.reduce(
    (acc, r) => ({
      usd: r.currency === "USD" ? acc.usd.plus(r.amount) : acc.usd,
      htg: r.currency === "HTG" ? acc.htg.plus(r.amount) : acc.htg,
    }),
    { usd: new Decimal(0), htg: new Decimal(0) },
  );
}

function formatPair(pair: { usd: Decimal; htg: Decimal }): string {
  const parts: string[] = [];
  if (!pair.usd.isZero()) parts.push(`${AMOUNT_FORMATTER.format(pair.usd.toNumber())} USD`);
  if (!pair.htg.isZero()) parts.push(`${AMOUNT_FORMATTER.format(pair.htg.toNumber())} HTG`);
  return parts.length > 0 ? parts.join(" / ") : "—";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUserOrRedirect();
  const { status } = await searchParams;

  const statusFilter = status && ["RECEIVED", "VERIFIED", "PAID", "CANCELLED"].includes(status)
    ? (status as TransactionStatus)
    : undefined;

  const isSupervisorOrAdmin = user.role === "SUPERVISOR" || user.role === "ADMIN";

  const [transactions, todaysTransactions, activeRates, openSession] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        createdAt: { gte: startOfToday() },
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(isSupervisorOrAdmin ? {} : { createdById: user.id }),
      },
      include: { client: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    // KPI toujours calculés sur l'ensemble du jour, indépendamment du filtre de statut affiché.
    prisma.transaction.findMany({
      where: {
        createdAt: { gte: startOfToday() },
        ...(isSupervisorOrAdmin ? {} : { createdById: user.id }),
      },
      select: { status: true, receivedCurrency: true, payoutCurrency: true, amountReceived: true, feeAmount: true, netPayout: true },
    }),
    prisma.pricingRule.findMany({
      where: { effectiveTo: null, exchangeRate: { not: null } },
      orderBy: { channel: "asc" },
    }),
    prisma.cashSession.findFirst({ where: { status: "OPEN" } }),
  ]);

  const notCancelled = todaysTransactions.filter((t) => t.status !== "CANCELLED");
  const volumeReceived = sumByCurrency(
    notCancelled.map((t) => ({ amount: new Decimal(t.amountReceived.toString()), currency: t.receivedCurrency })),
  );
  const feesCollected = sumByCurrency(
    notCancelled.map((t) => ({ amount: new Decimal(t.feeAmount.toString()), currency: t.receivedCurrency })),
  );
  const pendingPayout = sumByCurrency(
    notCancelled
      .filter((t) => t.status === "RECEIVED" || t.status === "VERIFIED")
      .map((t) => ({ amount: new Decimal(t.netPayout.toString()), currency: t.payoutCurrency })),
  );

  const statusCounts = notCancelled.reduce(
    (acc, t) => ({ ...acc, [t.status]: (acc[t.status] ?? 0) + 1 }),
    {} as Partial<Record<TransactionStatus, number>>,
  );

  const cashExpected = openSession ? await computeExpectedTotals(openSession.id) : null;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-neutral-500">Bienvenue, {user.fullName}.</p>
        </div>
        <Link
          href="/transactions/new"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Nouvelle transaction
        </Link>
      </div>

      {/* Bandeau KPI (§7.2) */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Transactions aujourd&apos;hui</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{notCancelled.length}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {statusCounts.RECEIVED ?? 0} reçue(s) · {statusCounts.VERIFIED ?? 0} vérifiée(s) ·{" "}
            {statusCounts.PAID ?? 0} payée(s)
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Volume reçu</p>
          <p className="mt-1 font-mono text-base font-semibold text-neutral-900">{formatPair(volumeReceived)}</p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Frais encaissés</p>
          <p className="mt-1 font-mono text-base font-semibold text-neutral-900">{formatPair(feesCollected)}</p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">En attente de remise</p>
          <p className="mt-1 font-mono text-base font-semibold text-amber-700">{formatPair(pendingPayout)}</p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Caisse commune</p>
          {openSession && cashExpected ? (
            <>
              <p className="mt-1 font-mono text-sm font-semibold text-green-700">
                {AMOUNT_FORMATTER.format(cashExpected.expectedUsd.toNumber())} USD
              </p>
              <p className="font-mono text-sm font-semibold text-green-700">
                {AMOUNT_FORMATTER.format(cashExpected.expectedHtg.toNumber())} HTG
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-neutral-400">Fermée</p>
          )}
        </div>
      </div>

      {/* Taux du jour (§7.2) */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <span className="text-xs uppercase text-neutral-500">Taux du jour</span>
        {activeRates.map((r) => (
          <span key={`${r.channel}-${r.payoutCurrency}`} className="font-mono text-sm text-neutral-900">
            {CHANNEL_LABEL[r.channel]} : <strong>{r.exchangeRate?.toString()}</strong>
          </span>
        ))}
        {activeRates.length === 0 ? <span className="text-sm text-neutral-400">Aucun taux HTG actif.</span> : null}
      </div>

      <div className="mt-6 flex gap-2 text-sm">
        <Link
          href="/dashboard"
          className={!statusFilter ? "rounded bg-neutral-900 px-3 py-1 text-white" : "rounded border border-neutral-300 px-3 py-1 text-neutral-600"}
        >
          Toutes
        </Link>
        {(Object.keys(STATUS_LABEL) as TransactionStatus[]).map((s) => (
          <Link
            key={s}
            href={`/dashboard?status=${s}`}
            className={
              statusFilter === s
                ? "rounded bg-neutral-900 px-3 py-1 text-white"
                : "rounded border border-neutral-300 px-3 py-1 text-neutral-600"
            }
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <DashboardExport
          rows={transactions.map((t) => ({
            time: TIME_FORMATTER.format(t.createdAt),
            receiptNo: t.receiptNo,
            channel: CHANNEL_LABEL[t.channel],
            client: t.client.fullName,
            netPayout: t.netPayout.toString(),
            payoutCurrency: t.payoutCurrency,
            status: STATUS_LABEL[t.status],
          }))}
        />
      </div>

      <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Heure</th>
              <th className="px-4 py-2">Reçu</th>
              <th className="px-4 py-2">Canal</th>
              <th className="px-4 py-2">Bénéficiaire</th>
              <th className="px-4 py-2">Montant remis</th>
              <th className="px-4 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-500">{TIME_FORMATTER.format(t.createdAt)}</td>
                <td className="px-4 py-2">
                  <Link href={`/transactions/${t.id}`} className="text-neutral-900 underline">
                    {t.receiptNo}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-700">{CHANNEL_LABEL[t.channel]}</td>
                <td className="px-4 py-2 text-neutral-700">{t.client.fullName}</td>
                <td className="px-4 py-2 text-neutral-900">
                  {AMOUNT_FORMATTER.format(Number(t.netPayout))} {t.payoutCurrency}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </td>
              </tr>
            ))}
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                  Aucune transaction pour l&apos;instant.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
