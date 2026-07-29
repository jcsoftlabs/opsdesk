import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TransactionStatus } from "@/generated/prisma/client";
import { DashboardExport } from "./DashboardExport";

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

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: startOfToday() },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(isSupervisorOrAdmin ? {} : { createdById: user.id }),
    },
    include: { client: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bienvenue, {user.fullName}. {transactions.length} transaction(s) aujourd&apos;hui.
          </p>
        </div>
        <Link
          href="/transactions/new"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Nouvelle transaction
        </Link>
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
