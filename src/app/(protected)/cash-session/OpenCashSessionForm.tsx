"use client";

import { useActionState } from "react";
import { openCashSessionAction, type OpenCashSessionState } from "./actions";

const initialState: OpenCashSessionState = {};

export function OpenCashSessionForm() {
  const [state, formAction, pending] = useActionState(openCashSessionAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="font-semibold text-neutral-900">Ouvrir ma caisse</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="openingUsd" className="block text-sm font-medium text-neutral-700">
            Fonds de départ USD
          </label>
          <input
            id="openingUsd"
            name="openingUsd"
            defaultValue="0"
            inputMode="decimal"
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="openingHtg" className="block text-sm font-medium text-neutral-700">
            Fonds de départ HTG
          </label>
          <input
            id="openingHtg"
            name="openingHtg"
            defaultValue="0"
            inputMode="decimal"
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Ouverture…" : "Ouvrir la caisse"}
      </button>
    </form>
  );
}
