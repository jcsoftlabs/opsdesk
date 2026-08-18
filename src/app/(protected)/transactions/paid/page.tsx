import Link from "next/link";
import Decimal from "decimal.js";
import { requireRoleOrRedirect, requireBureauId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addDays, businessWeekRange, mondayOf, parseDateParam, startOfDay, toDateParam } from "@/lib/businessWeek";
import type { Channel, Currency } from "@/generated/prisma/client";
import { PaidTransactionsExport } from "./PaidTransactionsExport";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });
const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", hour12: true });
const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function sumByCurrency(rows: { amount: Decimal; currency: "USD" | "HTG" }[]): { usd: Decimal; htg: Decimal } {
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

interface PaidSearchParams {
  from?: string;
  to?: string;
  channel?: string;
  currency?: string;
  agentId?: string;
  bureauId?: string;
}

/** Construit une URL en conservant les filtres actifs, sauf ceux explicitement remplacés. */
function buildHref(current: PaidSearchParams, overrides: PaidSearchParams): string {
  const merged: Record<string, string | undefined> = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/transactions/paid?${qs}` : "/transactions/paid";
}

export default async function PaidTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<PaidSearchParams>;
}) {
  const user = await requireRoleOrRedirect(["SUPERVISOR", "ADMIN"]);
  const sp = await searchParams;
  const bureauId = await requireBureauId(user, sp.bureauId);

  const channelFilter = sp.channel && Object.keys(CHANNEL_LABEL).includes(sp.channel) ? (sp.channel as Channel) : undefined;
  const currencyFilter = sp.currency && ["USD", "HTG"].includes(sp.currency) ? (sp.currency as Currency) : undefined;
  const agentFilter = sp.agentId;

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

  const [agents, transactions] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, bureauId },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        bureauId,
        status: "PAID",
        paidAt: { gte: rangeFrom, lt: rangeTo },
        ...(channelFilter ? { channel: channelFilter } : {}),
        ...(currencyFilter ? { payoutCurrency: currencyFilter } : {}),
        ...(agentFilter ? { paidById: agentFilter } : {}),
      },
      include: { client: { select: { fullName: true } }, paidBy: { select: { fullName: true } } },
      orderBy: { paidAt: "desc" },
      take: 200,
    }),
  ]);

  const totalPaid = sumByCurrency(
    transactions.map((t) => ({ amount: new Decimal(t.netPayout.toString()), currency: t.payoutCurrency })),
  );

  const rangeToInclusive = addDays(rangeTo, -1);
  const periodLabel =
    rangeFrom.getTime() === rangeToInclusive.getTime()
      ? DATE_FORMATTER.format(rangeFrom)
      : `${DATE_FORMATTER.format(rangeFrom)} – ${DATE_FORMATTER.format(rangeToInclusive)}`;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Transactions payées</h1>
          <p className="mt-1 text-sm text-neutral-500">Période : {periodLabel}.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Transactions payées</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{transactions.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:col-span-2">
          <p className="text-xs text-neutral-500">Montant total remis</p>
          <p className="mt-1 font-mono text-base font-semibold text-neutral-900">{formatPair(totalPaid)}</p>
        </div>
      </div>

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
          <div>
            <label htmlFor="agentId" className="block text-xs font-medium text-neutral-600">
              Payé par
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
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Filtrer
          </button>
          <Link
            href="/transactions/paid"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Réinitialiser
          </Link>
        </form>
      </section>

      <div className="mt-4 flex justify-end">
        <PaidTransactionsExport
          rows={transactions.map((t) => ({
            time: `${DATE_FORMATTER.format(t.paidAt ?? t.createdAt)} ${TIME_FORMATTER.format(t.paidAt ?? t.createdAt)}`,
            receiptNo: t.receiptNo,
            channel: CHANNEL_LABEL[t.channel],
            client: t.client.fullName,
            netPayout: t.netPayout.toString(),
            payoutCurrency: t.payoutCurrency,
            paidBy: t.paidBy?.fullName ?? "—",
          }))}
        />
      </div>

      <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Transactions payées pour la période sélectionnée</caption>
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th scope="col" className="px-4 py-2">Payée le</th>
              <th scope="col" className="px-4 py-2">Reçu</th>
              <th scope="col" className="px-4 py-2">Canal</th>
              <th scope="col" className="px-4 py-2">Bénéficiaire</th>
              <th scope="col" className="px-4 py-2">Montant remis</th>
              <th scope="col" className="px-4 py-2">Payé par</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-500">
                  {t.paidAt ? TIME_FORMATTER.format(t.paidAt) : "—"}
                </td>
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
                <td className="px-4 py-2 text-neutral-700">{t.paidBy?.fullName ?? "—"}</td>
              </tr>
            ))}
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                  Aucune transaction payée pour cette période.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
