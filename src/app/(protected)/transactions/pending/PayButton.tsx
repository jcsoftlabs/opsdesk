"use client";

import { useActionState, useState } from "react";
import { ID_TYPE_LABEL } from "@/lib/idType";
import { payTransactionAction, type SimpleActionState } from "./actions";

const initialState: SimpleActionState = {};

interface PayButtonProps {
  transactionId: string;
  netPayout: string;
  payoutCurrency: string;
  cashSessionOpen: boolean;
}

export function PayButton({ transactionId, netPayout, payoutCurrency, cashSessionOpen }: PayButtonProps) {
  const [state, formAction, pending] = useActionState(payTransactionAction, initialState);
  const [confirming, setConfirming] = useState(false);
  const [isProxy, setIsProxy] = useState(false);

  if (!confirming) {
    return (
      <div className="text-right">
        <button
          type="button"
          disabled={!cashSessionOpen}
          onClick={() => setConfirming(true)}
          title={cashSessionOpen ? undefined : "Ouvrez votre caisse pour payer"}
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Payer
        </button>
        {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      </div>
    );
  }

  return (
    <div className="relative text-right">
      <div className="absolute right-0 top-0 z-10 w-72 rounded border border-neutral-300 bg-white p-3 text-left shadow-lg">
        <p className="text-xs text-neutral-700">
          Confirmer la remise de <strong>{netPayout} {payoutCurrency}</strong> ?
        </p>

        <form action={formAction} className="mt-2 space-y-2">
          <input type="hidden" name="transactionId" value={transactionId} />
          <input type="hidden" name="confirmedNetPayout" value={netPayout} />

          <label className="flex items-center gap-1.5 text-xs text-neutral-700">
            <input
              type="checkbox"
              name="isProxy"
              checked={isProxy}
              onChange={(e) => setIsProxy(e.target.checked)}
            />
            Retiré par quelqu&apos;un d&apos;autre (procuration)
          </label>

          {isProxy ? (
            <div className="space-y-1.5 rounded bg-neutral-50 p-2">
              <input
                name="collectorFullName"
                placeholder="Nom complet"
                required={isProxy}
                className="block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
              />
              <div className="flex gap-1.5">
                <select
                  name="collectorIdType"
                  defaultValue="NIF"
                  className="rounded border border-neutral-300 bg-white px-1 py-1 text-xs text-neutral-900"
                >
                  {Object.entries(ID_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  name="collectorIdNumber"
                  placeholder="Numéro de pièce"
                  required={isProxy}
                  className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
                />
              </div>
              <input
                name="collectorPhone"
                placeholder="Téléphone (optionnel)"
                className="block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
              />
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? "…" : "Confirmer"}
            </button>
          </div>
        </form>
        {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      </div>
    </div>
  );
}
