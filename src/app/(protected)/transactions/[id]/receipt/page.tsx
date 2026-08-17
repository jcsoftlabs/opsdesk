import { notFound } from "next/navigation";
import { requireUserOrRedirect, requireBureauId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ReceiptTicket, type ReceiptData } from "@/components/ReceiptTicket";
import { PrintButton } from "@/components/PrintButton";
import { COMPANY_WHATSAPP_NUMBER } from "@/lib/company";

const CHANNEL_LABEL: Record<string, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserOrRedirect();
  const bureauId = requireBureauId(user);
  const { id } = await params;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { client: true, collectedBy: true, createdBy: { select: { fullName: true } } },
  });
  if (!transaction || transaction.bureauId !== bureauId) notFound();

  const data: ReceiptData = {
    receiptNo: transaction.receiptNo,
    createdAt: transaction.createdAt,
    channel: transaction.channel,
    externalRef: transaction.externalRef,
    senderName: transaction.senderName,
    clientFullName: transaction.client.fullName,
    clientIdType: transaction.client.idType,
    clientIdNumber: transaction.client.idNumber,
    collectedByFullName: transaction.collectedBy?.fullName ?? null,
    collectedByIdType: transaction.collectedBy?.idType ?? null,
    collectedByIdNumber: transaction.collectedBy?.idNumber ?? null,
    amountReceived: transaction.amountReceived.toString(),
    receivedCurrency: transaction.receivedCurrency,
    feePercentApplied: transaction.feePercentApplied.toString(),
    exchangeRateApplied: transaction.exchangeRateApplied?.toString() ?? null,
    netPayout: transaction.netPayout.toString(),
    payoutCurrency: transaction.payoutCurrency,
    cashierFullName: transaction.createdBy.fullName,
  };

  const recapText = [
    `Reçu ${transaction.receiptNo}`,
    `${CHANNEL_LABEL[transaction.channel] ?? transaction.channel} — réf. ${transaction.externalRef}`,
    `Montant remis : ${transaction.netPayout.toString()} ${transaction.payoutCurrency}`,
  ].join("\n");

  const whatsappNumber = transaction.client.phone
    ? transaction.client.phone.replace(/[^0-9+]/g, "")
    : COMPANY_WHATSAPP_NUMBER;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(recapText)}`;

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center gap-3 print:hidden">
        <PrintButton />
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          Envoyer par WhatsApp
        </a>
        {!transaction.client.phone ? (
          <span className="text-xs text-neutral-400">
            (numéro du bénéficiaire absent — numéro de l&apos;entreprise utilisé)
          </span>
        ) : null}
      </div>

      <div className="space-y-6">
        <ReceiptTicket data={data} copyLabel="EXEMPLAIRE CLIENT" />
        <ReceiptTicket data={data} copyLabel="EXEMPLAIRE ARCHIVE" />
      </div>
    </main>
  );
}
