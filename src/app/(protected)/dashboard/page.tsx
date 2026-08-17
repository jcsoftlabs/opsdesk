import Link from "next/link";
import Decimal from "decimal.js";
import { requireUserOrRedirect, requireBureauId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeExpectedTotals } from "@/app/(protected)/cash-session/actions";
import { addDays, businessWeekRange, mondayOf, parseDateParam, startOfDay, toDateParam } from "@/lib/businessWeek";
import type { Channel, Currency, TransactionStatus } from "@/generated/prisma/client";
import { DashboardExport } from "./DashboardExport";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<TransactionStatus, string> = {
  RECEIVED: "Reçue",
  VERIFIED: "Vérifiée",
  PAID: "Payée",
  CANCELLED: "Annulée",
};

const STATUS_BADGE: Record<TransactionStatus, string> = {
  RECEIVED: "bg-amber-100 text-amber-900",
  VERIFIED: "bg-blue-100 text-blue-900",
  PAID: "bg-green-100 text-green-900",
  CANCELLED: "bg-neutral-200 text-neutral-700",
};

const CHANNEL_LABEL: Record<string, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });
const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", hour12: true });
const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

interface DashboardSearchParams {
  status?: string;
  from?: string;
  to?: string;
  channel?: string;
  currency?: string;
  agentId?: string;
  bureauId?: string;
}

/** Construit une URL en conservant les filtres actifs, sauf ceux explicitement remplacés. */
function buildHref(current: DashboardSearchParams, overrides: DashboardSearchParams): string {
  const merged: Record<string, string | undefined> = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const user = await requireUserOrRedirect();
  const sp = await searchParams;
  const bureauId = await requireBureauId(user, sp.bureauId);
  const isSupervisorOrAdmin = user.role === "SUPERVISOR" || user.role === "ADMIN";

  const statusFilter = sp.status && ["RECEIVED", "VERIFIED", "PAID", "CANCELLED"].includes(sp.status)
    ? (sp.status as TransactionStatus)
    : undefined;
  const channelFilter = sp.channel && Object.keys(CHANNEL_LABEL).includes(sp.channel) ? (sp.channel as Channel) : undefined;
  const currencyFilter = sp.currency && ["USD", "HTG"].includes(sp.currency) ? (sp.currency as Currency) : undefined;
  const agentFilter = isSupervisorOrAdmin ? sp.agentId : undefined;

  const today = new Date();
  const parsedFrom = parseDateParam(sp.from);
  const parsedTo = parseDateParam(sp.to);
  const rangeFrom = parsedFrom ?? startOfDay(today);
  const rangeTo = parsedTo ? addDays(parsedTo, 1) : addDays(rangeFrom, 1);

  // Bornes des raccourcis, pour construire leurs liens et détecter le raccourci actif.
  const thisWeek = businessWeekRange(today);
  const lastWeek = businessWeekRange(addDays(mondayOf(today), -1));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const isActiveRange = (from: Date, to: Date) =>
    !parsedFrom && !parsedTo
      ? from.getTime() === startOfDay(today).getTime() && to.getTime() === addDays(startOfDay(today), 1).getTime()
      : parsedFrom?.getTime() === from.getTime() && addDays(parsedTo ?? from, 1).getTime() === to.getTime();

  const presets: { key: string; label: string; from: Date; to: Date }[] = [
    { key: "today", label: "Aujourd'hui", from: startOfDay(today), to: addDays(startOfDay(today), 1) },
    { key: "week", label: "Cette semaine (lun-sam)", from: thisWeek.from, to: thisWeek.to },
    { key: "lastWeek", label: "Semaine dernière", from: lastWeek.from, to: lastWeek.to },
    { key: "month", label: "Ce mois-ci", from: monthStart, to: monthEnd },
  ];

  const [agents, transactions, kpiTransactions, activeRates, openSession] = await Promise.all([
    isSupervisorOrAdmin
      ? prisma.user.findMany({
          where: { active: true, bureauId },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
    prisma.transaction.findMany({
      where: {
        bureauId,
        createdAt: { gte: rangeFrom, lt: rangeTo },
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(channelFilter ? { channel: channelFilter } : {}),
        ...(currencyFilter ? { payoutCurrency: currencyFilter } : {}),
        ...(isSupervisorOrAdmin ? (agentFilter ? { createdById: agentFilter } : {}) : { createdById: user.id }),
      },
      include: { client: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    // KPI calculés sur la même plage/filtres, mais indépendamment du filtre de statut affiché.
    prisma.transaction.findMany({
      where: {
        bureauId,
        createdAt: { gte: rangeFrom, lt: rangeTo },
        ...(channelFilter ? { channel: channelFilter } : {}),
        ...(currencyFilter ? { payoutCurrency: currencyFilter } : {}),
        ...(isSupervisorOrAdmin ? (agentFilter ? { createdById: agentFilter } : {}) : { createdById: user.id }),
      },
      select: { status: true, receivedCurrency: true, payoutCurrency: true, amountReceived: true, feeAmount: true, netPayout: true },
    }),
    prisma.pricingRule.findMany({
      where: { organizationId: user.organizationId, effectiveTo: null, exchangeRate: { not: null } },
      orderBy: { channel: "asc" },
    }),
    prisma.cashSession.findFirst({ where: { bureauId, status: "OPEN" } }),
  ]);

  const notCancelled = kpiTransactions.filter((t) => t.status !== "CANCELLED");
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
  const rangeToInclusive = addDays(rangeTo, -1);
  const periodLabel =
    rangeFrom.getTime() === rangeToInclusive.getTime()
      ? DATE_FORMATTER.format(rangeFrom)
      : `${DATE_FORMATTER.format(rangeFrom)} – ${DATE_FORMATTER.format(rangeToInclusive)}`;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bienvenue, {user.fullName}. Période : {periodLabel}.
          </p>
        </div>
        <Link
          href="/transactions/new"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Nouvelle transaction
        </Link>
      </div>

      {/* Bandeau KPI (§7.2) */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Transactions</p>
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

      {/* Filtres (§7.2 — entreprise ouverte lundi-samedi) */}
      <section aria-label="Filtres" className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap gap-2 text-sm" role="group" aria-label="Période rapide">
          {presets.map((p) => {
            const active = isActiveRange(p.from, p.to);
            return (
              <Link
                key={p.key}
                href={buildHref(sp, { from: toDateParam(p.from), to: toDateParam(addDays(p.to, -1)) })}
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "rounded bg-neutral-900 px-3 py-1 text-white"
                    : "rounded border border-neutral-300 px-3 py-1 text-neutral-600 hover:bg-neutral-50"
                }
              >
                {p.label}
              </Link>
            );
          })}
        </div>

        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="from" className="block text-xs font-medium text-neutral-600">
              Du
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={toDateParam(rangeFrom)}
              className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </div>
          <div>
            <label htmlFor="to" className="block text-xs font-medium text-neutral-600">
              Au
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={toDateParam(rangeToInclusive)}
              className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </div>
          <div>
            <label htmlFor="channel" className="block text-xs font-medium text-neutral-600">
              Canal
            </label>
            <select
              id="channel"
              name="channel"
              defaultValue={channelFilter ?? ""}
              className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            >
              <option value="">Tous</option>
              {Object.entries(CHANNEL_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="currency" className="block text-xs font-medium text-neutral-600">
              Devise remise
            </label>
            <select
              id="currency"
              name="currency"
              defaultValue={currencyFilter ?? ""}
              className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            >
              <option value="">Toutes</option>
              <option value="USD">USD</option>
              <option value="HTG">HTG</option>
            </select>
          </div>
          {isSupervisorOrAdmin ? (
            <div>
              <label htmlFor="agentId" className="block text-xs font-medium text-neutral-600">
                Agent
              </label>
              <select
                id="agentId"
                name="agentId"
                defaultValue={agentFilter ?? ""}
                className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
              >
                <option value="">Tous</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Filtrer
          </button>
          <Link href="/dashboard" className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">
            Réinitialiser
          </Link>
        </form>
      </section>

      <div className="mt-4 flex flex-wrap gap-2 text-sm" role="group" aria-label="Filtrer par statut">
        <Link
          href={buildHref(sp, { status: undefined })}
          aria-current={!statusFilter ? "true" : undefined}
          className={!statusFilter ? "rounded bg-neutral-900 px-3 py-1 text-white" : "rounded border border-neutral-300 px-3 py-1 text-neutral-600 hover:bg-neutral-50"}
        >
          Toutes
        </Link>
        {(Object.keys(STATUS_LABEL) as TransactionStatus[]).map((s) => (
          <Link
            key={s}
            href={buildHref(sp, { status: s })}
            aria-current={statusFilter === s ? "true" : undefined}
            className={
              statusFilter === s
                ? "rounded bg-neutral-900 px-3 py-1 text-white"
                : "rounded border border-neutral-300 px-3 py-1 text-neutral-600 hover:bg-neutral-50"
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
          <caption className="sr-only">Transactions pour la période sélectionnée</caption>
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th scope="col" className="px-4 py-2">Heure</th>
              <th scope="col" className="px-4 py-2">Reçu</th>
              <th scope="col" className="px-4 py-2">Canal</th>
              <th scope="col" className="px-4 py-2">Bénéficiaire</th>
              <th scope="col" className="px-4 py-2">Montant remis</th>
              <th scope="col" className="px-4 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-500">{TIME_FORMATTER.format(t.createdAt)}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/transactions/${t.id}`}
                    className="text-neutral-900 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                  >
                    {t.receiptNo}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-700">{CHANNEL_LABEL[t.channel]}</td>
                <td className="px-4 py-2 text-neutral-700">{t.client.fullName}</td>
                <td className="px-4 py-2 text-neutral-900">
                  {AMOUNT_FORMATTER.format(Number(t.netPayout))} {t.payoutCurrency}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </td>
              </tr>
            ))}
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                  Aucune transaction pour cette période.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
