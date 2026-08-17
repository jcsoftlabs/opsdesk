"use client";

import { useActionState } from "react";
import { createOrganizationAction, type CreateOrganizationState } from "../actions";

const initialState: CreateOrganizationState = {};

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialState);

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-neutral-200 bg-white p-6">
      <fieldset className="space-y-3">
        <legend className="font-medium text-neutral-900">Organisation</legend>
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-neutral-600">
            Nom
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Ex : Transfert Express"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-xs font-medium text-neutral-600">
            Téléphone (optionnel, affiché sur les reçus)
          </label>
          <input
            id="phone"
            name="phone"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="billingRatePerBureau" className="block text-xs font-medium text-neutral-600">
            Tarif mensuel par bureau (caisse) — USD
          </label>
          <input
            id="billingRatePerBureau"
            name="billingRatePerBureau"
            required
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium text-neutral-900">Premier bureau</legend>
        <div>
          <label htmlFor="bureauName" className="block text-xs font-medium text-neutral-600">
            Nom du bureau
          </label>
          <input
            id="bureauName"
            name="bureauName"
            required
            placeholder="Ex : Siège"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium text-neutral-900">Premier administrateur</legend>
        <div>
          <label htmlFor="adminFullName" className="block text-xs font-medium text-neutral-600">
            Nom complet
          </label>
          <input
            id="adminFullName"
            name="adminFullName"
            required
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="adminUsername" className="block text-xs font-medium text-neutral-600">
            Nom d&apos;utilisateur
          </label>
          <input
            id="adminUsername"
            name="adminUsername"
            required
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
      </fieldset>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Création…" : "Créer l'organisation"}
      </button>
    </form>
  );
}
