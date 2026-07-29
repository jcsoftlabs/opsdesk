import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CashSessionBanner } from "@/components/CashSessionBanner";
import { VerifyButton } from "./VerifyButton";
import { PayButton } from "./PayButton";

const CHANNEL_LABEL: Record<string, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};

const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PendingTransactionsPage() {
  const user = await requireRoleOrRedirect(["CASHIER", "SUPERVISOR", "ADMIN"]);

  const [received, verified, openSession] = await Promise.all([
    prisma.transaction.findMany({
      where: { status: "RECEIVED" },
      include: { client: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { status: "VERIFIED" },
      include: { client: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cashSession.findFirst({ where: { userId: user.id, status: "OPEN" } }),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <h1 className="text-lg font-semibold text-neutral-900">Vérification et paiement</h1>

      <CashSessionBanner
        open={openSession ? { openingUsd: openSession.openingUsd.toString(), openingHtg: openSession.openingHtg.toString() } : null}
      />

      <section>
        <h2 className="font-medium text-neutral-900">À vérifier ({received.length})</h2>
        <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Reçu</th>
                <th className="px-4 py-2">Canal</th>
                <th className="px-4 py-2">Bénéficiaire</th>
                <th className="px-4 py-2">Montant à remettre</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {received.map((t) => (
                <tr key={t.id} className="border-b border-neutral-100 last:border-0">
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
                    <VerifyButton transactionId={t.id} />
                  </td>
                </tr>
              ))}
              {received.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                    Rien à vérifier.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-medium text-neutral-900">À payer ({verified.length})</h2>
        <div className="mt-2 overflow-visible rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Reçu</th>
                <th className="px-4 py-2">Canal</th>
                <th className="px-4 py-2">Bénéficiaire</th>
                <th className="px-4 py-2">Montant à remettre</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {verified.map((t) => (
                <tr key={t.id} className="border-b border-neutral-100 last:border-0">
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
                    <PayButton
                      transactionId={t.id}
                      netPayout={t.netPayout.toString()}
                      payoutCurrency={t.payoutCurrency}
                      cashSessionOpen={Boolean(openSession)}
                    />
                  </td>
                </tr>
              ))}
              {verified.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                    Rien à payer.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
