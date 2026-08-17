"use client";

import { useActionState, useEffect, useState } from "react";
import { createMobileMoneyOperationAction, type CreateMobileMoneyOperationState } from "./actions";

const initialState: CreateMobileMoneyOperationState = {};

const OPERATION_LABEL: Record<string, string> = {
  RETRAIT: "Retrait (client retire de son compte)",
  DEPOT: "Dépôt (client dépose sur son compte)",
  TRANSFERT: "Transfert (vers un autre client du réseau)",
};

export function MobileMoneyForm() {
  const [state, formAction, pending] = useActionState(createMobileMoneyOperationAction, initialState);
  const [operationType, setOperationType] = useState("RETRAIT");
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      setFormKey((k) => k + 1);
      setOperationType("RETRAIT");
    }
  }, [state.success]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="font-semibold text-neutral-900">Enregistrer une opération</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Registre exigé par la BRH pour les agents MonCash/NatCash. Une fois enregistrée, une opération
        ne peut plus être modifiée ni supprimée.
      </p>

      <form key={formKey} action={formAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="provider" className="block text-xs font-medium text-neutral-600">
            Réseau
          </label>
          <select
            id="provider"
            name="provider"
            required
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          >
            <option value="MONCASH">MonCash</option>
            <option value="NATCASH">NatCash</option>
          </select>
        </div>

        <div>
          <label htmlFor="operationType" className="block text-xs font-medium text-neutral-600">
            Type d&apos;opération
          </label>
          <select
            id="operationType"
            name="operationType"
            required
            value={operationType}
            onChange={(e) => setOperationType(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          >
            {Object.entries(OPERATION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="clientNumber" className="block text-xs font-medium text-neutral-600">
            Numéro du client
          </label>
          <input
            id="clientNumber"
            name="clientNumber"
            required
            inputMode="tel"
            placeholder="Ex : 3712 3456"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-xs font-medium text-neutral-600">
            Montant (HTG)
          </label>
          <input
            id="amount"
            name="amount"
            required
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>

        {operationType === "TRANSFERT" ? (
          <div className="sm:col-span-2">
            <label htmlFor="destinataireNumber" className="block text-xs font-medium text-neutral-600">
              Numéro du destinataire (autre client du réseau)
            </label>
            <input
              id="destinataireNumber"
              name="destinataireNumber"
              required
              inputMode="tel"
              placeholder="Ex : 3798 7654"
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Enregistrement…" : "Enregistrer l'opération"}
          </button>
        </div>
      </form>

      {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
      {state.success ? (
        <p className="mt-2 text-sm text-green-700">
          Opération enregistrée.{" "}
          <button
            type="button"
            onClick={() => setFormKey((k) => k + 1)}
            className="underline"
          >
            Nouvelle opération
          </button>
        </p>
      ) : null}
    </div>
  );
}
