import { COMPANY_NAME, COMPANY_PHONE_DISPLAY } from "@/lib/company";
import { ID_TYPE_LABEL } from "@/lib/idType";

const CHANNEL_LABEL: Record<string, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", hour12: true });
const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface ReceiptData {
  receiptNo: string;
  createdAt: Date;
  channel: string;
  externalRef: string;
  senderName: string;
  clientFullName: string;
  clientIdType: string;
  clientIdNumber: string;
  collectedByFullName: string | null;
  collectedByIdType: string | null;
  collectedByIdNumber: string | null;
  amountReceived: string;
  receivedCurrency: string;
  feePercentApplied: string;
  exchangeRateApplied: string | null;
  netPayout: string;
  payoutCurrency: string;
  cashierFullName: string;
}

export function ReceiptTicket({ data, copyLabel }: { data: ReceiptData; copyLabel: string }) {
  return (
    <div className="receipt-copy mx-auto w-[80mm] max-w-full border border-dashed border-neutral-300 bg-white p-4 font-mono text-xs text-neutral-900">
      <div className="text-center">
        <p className="font-semibold">{COMPANY_NAME}</p>
        <p>{COMPANY_PHONE_DISPLAY}</p>
        <p className="mt-1">— {copyLabel} —</p>
      </div>

      <hr className="my-2 border-dashed border-neutral-400" />

      <div className="space-y-0.5">
        <Row label="Reçu" value={data.receiptNo} />
        <Row label="Date" value={DATE_FORMATTER.format(data.createdAt)} />
        <Row label="Canal" value={CHANNEL_LABEL[data.channel] ?? data.channel} />
        <Row label="Référence" value={data.externalRef} />
        <Row label="Expéditeur" value={data.senderName} />
      </div>

      <hr className="my-2 border-dashed border-neutral-400" />

      <div className="space-y-0.5">
        <Row label="Bénéficiaire" value={data.clientFullName} />
        <Row label="Pièce" value={`${ID_TYPE_LABEL[data.clientIdType] ?? data.clientIdType} ${data.clientIdNumber}`} />
      </div>

      {data.collectedByFullName ? (
        <>
          <hr className="my-2 border-dashed border-neutral-400" />
          <div className="space-y-0.5">
            <Row label="Reçu par (procuration)" value={data.collectedByFullName} />
            <Row
              label="Pièce"
              value={`${ID_TYPE_LABEL[data.collectedByIdType ?? ""] ?? data.collectedByIdType} ${data.collectedByIdNumber}`}
            />
          </div>
        </>
      ) : null}

      <hr className="my-2 border-dashed border-neutral-400" />

      <div className="space-y-0.5">
        <Row label="Montant reçu" value={`${AMOUNT_FORMATTER.format(Number(data.amountReceived))} ${data.receivedCurrency}`} />
        <Row label="Frais" value={`${data.feePercentApplied} %`} />
        {data.exchangeRateApplied ? <Row label="Taux" value={data.exchangeRateApplied} /> : null}
      </div>

      <hr className="my-2 border-dashed border-neutral-400" />

      <div className="flex justify-between text-sm font-semibold">
        <span>À REMETTRE</span>
        <span>
          {AMOUNT_FORMATTER.format(Number(data.netPayout))} {data.payoutCurrency}
        </span>
      </div>

      <hr className="my-2 border-dashed border-neutral-400" />

      <Row label="Caissier" value={data.cashierFullName} />

      <div className="mt-6">
        <p>Signature {data.collectedByFullName ? "(procuration)" : "du client"} :</p>
        <p className="mt-6 border-t border-neutral-400" />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
