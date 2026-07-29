"use client";

import { useActionState, useState } from "react";
import { openCashSessionAction, type OpenCashSessionState } from "@/app/(protected)/cash-session/actions";

const initialState: OpenCashSessionState = {};

interface CashSessionBannerProps {
  open: { openingUsd: string; openingHtg: string } | null;
}

export function CashSessionBanner({ open }: CashSessionBannerProps) {
  const [state, formAction, pending] = useActionState(openCashSessionAction, initialState);
  const [showForm, setShowForm] = useState(false);

  if (open) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-900">
        <span>
          Caisse ouverte — fonds de départ {open.openingUsd} USD / {open.openingHtg} HTG
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-amber-900">Aucune session de caisse ouverte. Le paiement est bloqué.</p>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Ouvrir ma caisse
          </button>
        ) : null}
      </div>

      {showForm ? (
        <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="openingUsd" className="block text-xs font-medium text-neutral-600">
              Fonds de départ USD
            </label>
            <input
              id="openingUsd"
              name="openingUsd"
              defaultValue="0"
              inputMode="decimal"
              className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </div>
          <div>
            <label htmlFor="openingHtg" className="block text-xs font-medium text-neutral-600">
              Fonds de départ HTG
            </label>
            <input
              id="openingHtg"
              name="openingHtg"
              defaultValue="0"
              inputMode="decimal"
              className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Ouverture…" : "Confirmer l'ouverture"}
          </button>
        </form>
      ) : null}

      {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
    </div>
  );
}
