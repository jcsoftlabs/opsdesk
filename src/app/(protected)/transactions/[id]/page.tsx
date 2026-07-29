import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ID_TYPE_LABEL } from "@/lib/idType";

const CHANNEL_LABEL: Record<string, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "Reçue",
  VERIFIED: "Vérifiée",
  PAID: "Payée",
  CANCELLED: "Annulée",
};

const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUserOrRedirect();
  const { id } = await params;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { client: true, createdBy: { select: { fullName: true } } },
  });
  if (!transaction) notFound();

  const rows: [string, string][] = [
    ["Reçu", transaction.receiptNo],
    ["Statut", STATUS_LABEL[transaction.status]],
    ["Canal", CHANNEL_LABEL[transaction.channel]],
    ["Référence", transaction.externalRef],
    ["Expéditeur", transaction.senderName],
    ["Bénéficiaire", transaction.client.fullName],
    ["Pièce d'identité", `${ID_TYPE_LABEL[transaction.client.idType]} ${transaction.client.idNumber}`],
    ["Montant reçu", `${AMOUNT_FORMATTER.format(Number(transaction.amountReceived))} ${transaction.receivedCurrency}`],
    ["Frais appliqués", `${transaction.feePercentApplied.toString()} %`],
    ["Taux appliqué", transaction.exchangeRateApplied?.toString() ?? "—"],
    ["Montant remis", `${AMOUNT_FORMATTER.format(Number(transaction.netPayout))} ${transaction.payoutCurrency}`],
    ["Enregistrée par", transaction.createdBy.fullName],
  ];

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Transaction {transaction.receiptNo}</h1>
        <Link
          href={`/transactions/${transaction.id}/receipt`}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          Voir le reçu
        </Link>
      </div>
      <dl className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-2 text-sm">
            <dt className="text-neutral-500">{label}</dt>
            <dd className="font-medium text-neutral-900">{value}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
