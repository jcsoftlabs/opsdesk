"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { calculatePricing, RECEIVED_CURRENCY_BY_CHANNEL, type Channel, type Currency } from "@/lib/pricing";
import { updatePricingRuleAction, type UpdatePricingRuleState } from "./actions";

const CHANNEL_LABEL: Record<Channel, string> = {
  ZELLE: "Zelle",
  CASHAPP: "CashApp",
  DEPOSIT_USD: "Dépôt USD",
  TRANSFER_HTG: "Virement HTG",
};

const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PREVIEW_AMOUNT = 500;

export interface PricingRuleDTO {
  channel: Channel;
  payoutCurrency: Currency;
  allowed: boolean;
  feePercent: string;
  exchangeRate: string | null;
  feeBeforeConversion: boolean;
  roundingUnit: string;
}

const initialState: UpdatePricingRuleState = {};

export function PricingRuleRow({ rule }: { rule: PricingRuleDTO }) {
  const [state, formAction, pending] = useActionState(updatePricingRuleAction, initialState);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [allowed, setAllowed] = useState(rule.allowed);
  const [feePercent, setFeePercent] = useState(rule.feePercent);
  const [exchangeRate, setExchangeRate] = useState(rule.exchangeRate ?? "");
  const [feeBeforeConversion, setFeeBeforeConversion] = useState(rule.feeBeforeConversion);
  const [roundingUnit, setRoundingUnit] = useState(rule.roundingUnit);

  const needsConversion = RECEIVED_CURRENCY_BY_CHANNEL[rule.channel] !== rule.payoutCurrency;

  const preview = useMemo(() => {
    if (!allowed) return null;
    try {
      return calculatePricing(
        {
          channel: rule.channel,
          payoutCurrency: rule.payoutCurrency,
          allowed,
          feePercent,
          exchangeRate: exchangeRate || null,
          feeBeforeConversion,
          roundingUnit,
        },
        PREVIEW_AMOUNT,
      );
    } catch {
      return null;
    }
  }, [allowed, feePercent, exchangeRate, feeBeforeConversion, roundingUnit, rule.channel, rule.payoutCurrency]);

  function cancelEdit() {
    setEditing(false);
    setConfirming(false);
    setAllowed(rule.allowed);
    setFeePercent(rule.feePercent);
    setExchangeRate(rule.exchangeRate ?? "");
    setFeeBeforeConversion(rule.feeBeforeConversion);
    setRoundingUnit(rule.roundingUnit);
  }

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setEditing(false);
      setConfirming(false);
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  if (!editing) {
    return (
      <tr className="border-b border-neutral-100 last:border-0">
        <td className="px-4 py-2 text-neutral-900">{CHANNEL_LABEL[rule.channel]}</td>
        <td className="px-4 py-2 text-neutral-700">{rule.payoutCurrency}</td>
        <td className="px-4 py-2 text-neutral-700">{rule.allowed ? `${rule.feePercent} %` : "—"}</td>
        <td className="px-4 py-2 text-neutral-700">{rule.exchangeRate ?? "—"}</td>
        <td className="px-4 py-2">
          <span
            className={
              rule.allowed
                ? "rounded bg-green-100 px-2 py-0.5 text-xs text-green-800"
                : "rounded bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600"
            }
          >
            {rule.allowed ? "Autorisé" : "Interdit"}
          </span>
        </td>
        <td className="px-4 py-2 text-right">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            Modifier
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-neutral-100 bg-neutral-50 last:border-0 align-top">
      <td className="px-4 py-3 font-medium text-neutral-900" colSpan={6}>
        <div className="flex items-center justify-between">
          <span>
            {CHANNEL_LABEL[rule.channel]} → {rule.payoutCurrency}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex items-center gap-1.5 text-sm text-neutral-700 sm:col-span-4">
            <input type="checkbox" checked={allowed} onChange={(e) => setAllowed(e.target.checked)} />
            Combinaison autorisée
          </label>

          <div>
            <label className="block text-xs font-medium text-neutral-600">Frais (%)</label>
            <input
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </div>

          {needsConversion ? (
            <div>
              <label className="block text-xs font-medium text-neutral-600">Taux de change</label>
              <input
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
              />
            </div>
          ) : null}

          {rule.payoutCurrency === "HTG" ? (
            <div>
              <label className="block text-xs font-medium text-neutral-600">Unité d&apos;arrondi</label>
              <input
                value={roundingUnit}
                onChange={(e) => setRoundingUnit(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
              />
            </div>
          ) : null}

          <label className="flex items-center gap-1.5 text-sm text-neutral-700 sm:col-span-4">
            <input
              type="checkbox"
              checked={feeBeforeConversion}
              onChange={(e) => setFeeBeforeConversion(e.target.checked)}
            />
            Frais retirés avant conversion
          </label>
        </div>

        <div className="mt-3 rounded border border-neutral-200 bg-white p-2 font-mono text-xs text-neutral-900">
          {preview ? (
            <>
              Aperçu sur {AMOUNT_FORMATTER.format(PREVIEW_AMOUNT)} {preview.receivedCurrency} → frais{" "}
              {preview.feeAmount.toString()}
              {preview.exchangeRateApplied ? `, taux ${preview.exchangeRateApplied.toString()}` : ""} → à remettre{" "}
              <strong>
                {AMOUNT_FORMATTER.format(preview.netPayout.toNumber())} {preview.payoutCurrency}
              </strong>
            </>
          ) : allowed ? (
            <span className="text-red-600">Valeurs invalides — vérifiez les champs.</span>
          ) : (
            <span className="text-neutral-500">Combinaison interdite.</span>
          )}
        </div>

        {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}

        <div className="mt-3 flex justify-end gap-2">
          {!confirming ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!preview && allowed}
                onClick={() => setConfirming(true)}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Enregistrer
              </button>
            </>
          ) : (
            <form action={formAction} className="flex items-center gap-2">
              <input type="hidden" name="channel" value={rule.channel} />
              <input type="hidden" name="payoutCurrency" value={rule.payoutCurrency} />
              <input type="hidden" name="allowed" value={allowed ? "on" : ""} />
              <input type="hidden" name="feePercent" value={feePercent} />
              <input type="hidden" name="exchangeRate" value={exchangeRate} />
              <input type="hidden" name="feeBeforeConversion" value={feeBeforeConversion ? "on" : ""} />
              <input type="hidden" name="roundingUnit" value={roundingUnit} />
              <span className="text-sm text-amber-700">Confirmer ce changement de tarif ?</span>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600"
              >
                Non
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "…" : "Confirmer"}
              </button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}
