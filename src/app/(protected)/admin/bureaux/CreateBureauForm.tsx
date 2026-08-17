"use client";

import { useActionState } from "react";
import { createBureauAction, type CreateBureauState } from "./actions";

const initialState: CreateBureauState = {};

export function CreateBureauForm() {
  const [state, formAction, pending] = useActionState(createBureauAction, initialState);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="font-medium text-neutral-900">Nouveau bureau</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Chaque bureau a sa propre caisse commune, ses propres clients et transactions. La
        facturation se fait par bureau actif.
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-neutral-600">
            Nom du bureau
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Ex : Kmat Supply — Delmas"
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Création…" : "Créer"}
        </button>
      </form>
      {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
    </div>
  );
}
