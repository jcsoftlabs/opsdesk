"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AttachmentUploader, type UploadedAttachment } from "@/components/AttachmentUploader";
import { calculatePricing, type Channel, type Currency } from "@/lib/pricing";
import { ID_TYPE_LABEL } from "@/lib/idType";
import {
  createTransactionAction,
  getRecentSendersForClientAction,
  searchClientsAction,
  type ClientSearchResult,
  type CreateTransactionState,
} from "./actions";

export interface ActiveRuleDTO {
  channel: Channel;
  payoutCurrency: Currency;
  allowed: boolean;
  feePercent: string;
  exchangeRate: string | null;
  feeBeforeConversion: boolean;
  roundingUnit: string;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};


const AMOUNT_FORMATTER_USD = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const AMOUNT_FORMATTER_HTG = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const initialState: CreateTransactionState = {};

export function NewTransactionForm({ activeRules }: { activeRules: ActiveRuleDTO[] }) {
  const [state, formAction, pending] = useActionState(createTransactionAction, initialState);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [payoutCurrency, setPayoutCurrency] = useState<Currency | null>(null);

  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [recentSenders, setRecentSenders] = useState<string[]>([]);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const senderNameRef = useRef<HTMLInputElement>(null);

  const [paymentAttachments, setPaymentAttachments] = useState<UploadedAttachment[]>([]);
  const [idAttachments, setIdAttachments] = useState<UploadedAttachment[]>([]);

  const attachmentsJson = useMemo(
    () =>
      JSON.stringify([
        ...paymentAttachments.map((a) => ({ publicId: a.publicId, kind: "PAYMENT_SCREENSHOT" as const })),
        ...idAttachments.map((a) => ({ publicId: a.publicId, kind: "ID_DOCUMENT" as const })),
      ]),
    [paymentAttachments, idAttachments],
  );

  const activeRule = useMemo(
    () => activeRules.find((r) => r.channel === channel && r.payoutCurrency === payoutCurrency) ?? null,
    [activeRules, channel, payoutCurrency],
  );

  const preview = useMemo(() => {
    if (!activeRule || !amountReceived || Number.isNaN(Number(amountReceived))) return null;
    try {
      return calculatePricing(activeRule, amountReceived);
    } catch {
      return null;
    }
  }, [activeRule, amountReceived]);

  function handleChannelSelect(next: Channel) {
    setChannel(next);
    if (next === "TRANSFER_HTG" && payoutCurrency === "USD") setPayoutCurrency(null);
  }

  function handleClientQueryChange(value: string) {
    setClientQuery(value);
    setSelectedClient(null);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (value.trim().length < 2) {
      setClientResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      const results = await searchClientsAction(value);
      setClientResults(results);
    }, 300);
  }

  if (state.success) {
    return (
      <div className="max-w-xl rounded-lg border border-green-200 bg-green-50 p-6">
        <h2 className="font-semibold text-green-900">Transaction enregistrée</h2>
        <p className="mt-1 text-sm text-green-800">
          Reçu <strong>{state.success.receiptNo}</strong> — statut « reçue », en attente de vérification.
        </p>
        <div className="mt-4 flex gap-3">
          <Link href="/dashboard" className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">
            Retour au tableau de bord
          </Link>
          <Link href="/transactions/new" className="rounded border border-neutral-300 px-3 py-1.5 text-sm">
            Nouvelle transaction
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-8">
      <input type="hidden" name="channel" value={channel ?? ""} />
      <input type="hidden" name="payoutCurrency" value={payoutCurrency ?? ""} />
      <input type="hidden" name="clientId" value={selectedClient?.id ?? ""} />
      <input type="hidden" name="attachments" value={attachmentsJson} />

      {/* Bloc 1 — Origine */}
      <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold text-neutral-900">1. Origine</h2>

        <div>
          <p className="text-sm font-medium text-neutral-700">Canal</p>
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={channel === c}
                onClick={() => handleChannelSelect(c)}
                className={
                  channel === c
                    ? "rounded border-2 border-neutral-900 bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
                    : "rounded border-2 border-neutral-200 bg-white px-3 py-3 text-sm font-medium text-neutral-700 hover:border-neutral-400"
                }
              >
                {CHANNEL_LABEL[c]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            La référence de la transaction est générée automatiquement à l&apos;enregistrement (elle
            n&apos;est pas toujours visible sur la capture d&apos;écran).
          </p>
        </div>

        <div>
          <label htmlFor="senderName" className="block text-sm font-medium text-neutral-700">
            Nom de l&apos;expéditeur
          </label>
          <input
            id="senderName"
            name="senderName"
            required
            ref={senderNameRef}
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="amountReceived" className="block text-sm font-medium text-neutral-700">
            Montant reçu
          </label>
          <input
            id="amountReceived"
            name="amountReceived"
            required
            inputMode="decimal"
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>

        <AttachmentUploader
          label="Capture d'écran du paiement"
          hint="Photo ou capture WhatsApp de la transaction Zelle/CashApp/virement"
          onUploaded={(a) => setPaymentAttachments((prev) => [...prev, a])}
          onRemoved={(id) => setPaymentAttachments((prev) => prev.filter((a) => a.publicId !== id))}
        />
      </section>

      {/* Bloc 2 — Bénéficiaire */}
      <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold text-neutral-900">2. Bénéficiaire</h2>

        <div>
          <label htmlFor="clientQuery" className="block text-sm font-medium text-neutral-700">
            Rechercher par numéro de pièce ou nom
          </label>
          <input
            id="clientQuery"
            value={clientQuery}
            onChange={(e) => handleClientQueryChange(e.target.value)}
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
          {clientResults.length > 0 && !selectedClient ? (
            <ul className="mt-1 divide-y divide-neutral-100 rounded border border-neutral-200 bg-white">
              {clientResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      setSelectedClient(c);
                      setClientResults([]);
                      setClientQuery(c.fullName);
                      setRecentSenders(await getRecentSendersForClientAction(c.id));
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  >
                    <span className="font-medium text-neutral-900">{c.fullName}</span>{" "}
                    <span className="text-neutral-500">
                      — {ID_TYPE_LABEL[c.idType]} {c.idNumber}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {selectedClient ? (
          <div className="flex items-center justify-between rounded bg-neutral-50 px-3 py-2 text-sm">
            <span>
              <strong className="text-neutral-900">{selectedClient.fullName}</strong>{" "}
              <span className="text-neutral-500">
                — {ID_TYPE_LABEL[selectedClient.idType]} {selectedClient.idNumber}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedClient(null);
                setClientQuery("");
                setRecentSenders([]);
              }}
              className="text-neutral-500 hover:text-neutral-900"
            >
              Changer
            </button>
          </div>
        ) : null}

        {recentSenders.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-neutral-500">
              Déjà envoyé à ce bénéficiaire — cliquer pour préremplir l&apos;expéditeur :
            </span>
            {recentSenders.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  if (senderNameRef.current) senderNameRef.current.value = name;
                }}
                className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100"
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}

        {!selectedClient ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="clientFullName" className="block text-sm font-medium text-neutral-700">
                Nom complet
              </label>
              <input
                id="clientFullName"
                name="clientFullName"
                className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="clientIdType" className="block text-sm font-medium text-neutral-700">
                Type de pièce
              </label>
              <select
                id="clientIdType"
                name="clientIdType"
                defaultValue="NIF"
                className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
              >
                {Object.entries(ID_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="clientIdNumber" className="block text-sm font-medium text-neutral-700">
                Numéro de pièce
              </label>
              <input
                id="clientIdNumber"
                name="clientIdNumber"
                className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="clientPhone" className="block text-sm font-medium text-neutral-700">
                Téléphone
              </label>
              <input
                id="clientPhone"
                name="clientPhone"
                className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <AttachmentUploader
                label="Photo de la pièce d'identité"
                onUploaded={(a) => setIdAttachments((prev) => [...prev, a])}
                onRemoved={(id) => setIdAttachments((prev) => prev.filter((a) => a.publicId !== id))}
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* Bloc 3 — Remise */}
      <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold text-neutral-900">3. Remise</h2>

        <div>
          <p className="text-sm font-medium text-neutral-700">Devise voulue</p>
          <div className="mt-1 flex gap-2">
            {(["USD", "HTG"] as Currency[]).map((cur) => {
              const disabled = channel === "TRANSFER_HTG" && cur === "USD";
              return (
                <button
                  key={cur}
                  type="button"
                  disabled={disabled}
                  aria-pressed={payoutCurrency === cur}
                  onClick={() => setPayoutCurrency(cur)}
                  className={
                    payoutCurrency === cur
                      ? "rounded border-2 border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
                      : "rounded border-2 border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"
                  }
                >
                  {cur}
                </button>
              );
            })}
          </div>
          {channel === "TRANSFER_HTG" ? (
            <p className="mt-1 text-xs text-neutral-500">
              Virement en gourdes : remise en gourdes uniquement.
            </p>
          ) : null}
        </div>

        {preview ? (
          <div className="rounded bg-neutral-50 p-4 font-mono text-sm text-neutral-900">
            <div className="flex justify-between">
              <span>Montant reçu</span>
              <span>
                {AMOUNT_FORMATTER_USD.format(Number(amountReceived))} {preview.receivedCurrency}
              </span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Frais ({preview.feePercentApplied.toString()} %)</span>
              <span>−{AMOUNT_FORMATTER_USD.format(preview.feeAmount.toNumber())}</span>
            </div>
            {preview.exchangeRateApplied ? (
              <div className="flex justify-between text-neutral-600">
                <span>Taux appliqué</span>
                <span>{preview.exchangeRateApplied.toString()}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-neutral-300 pt-2 text-base font-semibold">
              <span>À REMETTRE</span>
              <span>
                {preview.payoutCurrency === "HTG"
                  ? AMOUNT_FORMATTER_HTG.format(preview.netPayout.toNumber())
                  : AMOUNT_FORMATTER_USD.format(preview.netPayout.toNumber())}{" "}
                {preview.payoutCurrency}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">
            Choisissez un canal, un montant et une devise pour voir le récapitulatif.
          </p>
        )}

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !preview}
          className="rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </section>
    </form>
  );
}
