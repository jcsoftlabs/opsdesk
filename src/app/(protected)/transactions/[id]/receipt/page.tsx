import { notFound } from "next/navigation";
import { requireUserOrRedirect, requireBureauId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ReceiptTicket, type ReceiptData } from "@/components/ReceiptTicket";
import { PrintButton } from "@/components/PrintButton";

const CHANNEL_LABEL: Record<string, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserOrRedirect();
  const bureauId = await requireBureauId(user);
  const { id } = await params;

  const [transaction, organization] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id },
      include: { client: true, collectedBy: true, createdBy: { select: { fullName: true } } },
    }),
    prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } }),
  ]);
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
    companyName: organization.name,
    companyPhone: organization.phone,
  };

  const recapText = [
    `Reçu ${transaction.receiptNo}`,
    `${CHANNEL_LABEL[transaction.channel] ?? transaction.channel} — réf. ${transaction.externalRef}`,
    `Montant remis : ${transaction.netPayout.toString()} ${transaction.payoutCurrency}`,
  ].join("\n");

  // Numéro de secours si le bénéficiaire n'en a pas : premier numéro trouvé
  // dans le téléphone affiché de l'entreprise (peut lister plusieurs numéros
  // séparés par "/", ex. "+509 34 40 3636 / 36 00 1818").
  const companyWhatsappNumber = organization.phone?.split("/")[0]?.replace(/[^0-9+]/g, "") ?? "";
  const whatsappNumber = transaction.client.phone
    ? transaction.client.phone.replace(/[^0-9+]/g, "")
    : companyWhatsappNumber;
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
