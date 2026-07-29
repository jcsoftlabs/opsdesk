"use client";

import { useActionState } from "react";
import { updateReferenceRateAction, type UpdateReferenceRateState } from "./actions";

const initialState: UpdateReferenceRateState = {};

export function ReferenceRateForm({ currentRate }: { currentRate: string | null }) {
  const [state, formAction, pending] = useActionState(updateReferenceRateAction, initialState);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="font-semibold text-neutral-900">Taux de référence du marché</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Utilisé pour calculer la marge de change dans les rapports (§7.8). Indépendant du taux appliqué
        au client.
      </p>
      <p className="mt-2 text-sm text-neutral-700">
        Taux actuel : <strong>{currentRate ?? "non renseigné"}</strong>
      </p>
      <form action={formAction} className="mt-3 flex items-end gap-3">
        <div>
          <label htmlFor="rate" className="block text-xs font-medium text-neutral-600">
            Nouveau taux (1 USD = ? HTG)
          </label>
          <input
            id="rate"
            name="rate"
            inputMode="decimal"
            defaultValue={currentRate ?? ""}
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Mise à jour…" : "Mettre à jour"}
        </button>
      </form>
      {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
    </div>
  );
}
