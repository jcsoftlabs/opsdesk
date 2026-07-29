"use client";

import { useActionState } from "react";
import { addCashTopUpAction, type AddTopUpState } from "./actions";

const initialState: AddTopUpState = {};

export function TopUpForm() {
  const [state, formAction, pending] = useActionState(addCashTopUpAction, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="font-semibold text-neutral-900">Apport de liquidités</h2>
      <p className="text-xs text-neutral-500">
        Livraison de cash en cours de journée pour augmenter les liquidités de la caisse commune.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="topup-currency" className="block text-xs font-medium text-neutral-600">
            Devise
          </label>
          <select
            id="topup-currency"
            name="currency"
            defaultValue="HTG"
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          >
            <option value="USD">USD</option>
            <option value="HTG">HTG</option>
          </select>
        </div>
        <div>
          <label htmlFor="topup-amount" className="block text-xs font-medium text-neutral-600">
            Montant
          </label>
          <input
            id="topup-amount"
            name="amount"
            inputMode="decimal"
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="topup-note" className="block text-xs font-medium text-neutral-600">
            Note (optionnel)
          </label>
          <input
            id="topup-note"
            name="note"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Ajout…" : "Ajouter"}
        </button>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
