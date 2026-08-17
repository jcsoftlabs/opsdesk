"use client";

import { useActionState } from "react";
import {
  toggleOrganizationActiveAction,
  archiveOrganizationAction,
  updateOrganizationInfoAction,
  updateBillingRateAction,
  generateInvoiceAction,
  markInvoicePaidAction,
  togglePlatformBureauActiveAction,
  type ToggleOrganizationState,
  type ArchiveOrganizationState,
  type UpdateOrganizationInfoState,
  type UpdateBillingRateState,
  type GenerateInvoiceState,
  type MarkInvoicePaidState,
  type ToggleBureauActiveState,
} from "../actions";

export function ToggleOrganizationActiveButton({ organizationId, active }: { organizationId: string; active: boolean }) {
  const [state, action, pending] = useActionState<ToggleOrganizationState, FormData>(
    toggleOrganizationActiveAction,
    {},
  );
  return (
    <form action={action}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <button
        type="submit"
        disabled={pending}
        className={
          active
            ? "rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            : "rounded border border-green-300 bg-white px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50"
        }
      >
        {active ? "Suspendre l'accès" : "Réactiver l'accès"}
      </button>
      {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function ArchiveOrganizationButton({ organizationId, archived }: { organizationId: string; archived: boolean }) {
  const [state, action, pending] = useActionState<ArchiveOrganizationState, FormData>(archiveOrganizationAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        {archived ? "Désarchiver" : "Archiver (client parti)"}
      </button>
      {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function UpdateOrganizationInfoForm({
  organizationId,
  currentName,
  currentPhone,
}: {
  organizationId: string;
  currentName: string;
  currentPhone: string;
}) {
  const [state, action, pending] = useActionState<UpdateOrganizationInfoState, FormData>(updateOrganizationInfoAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div>
        <label htmlFor="name" className="block text-xs font-medium text-neutral-600">
          Nom
        </label>
        <input
          id="name"
          name="name"
          defaultValue={currentName}
          required
          className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-xs font-medium text-neutral-600">
          Téléphone
        </label>
        <input
          id="phone"
          name="phone"
          defaultValue={currentPhone}
          className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        Mettre à jour
      </button>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function ToggleBureauActiveButton({ bureauId, active }: { bureauId: string; active: boolean }) {
  const [state, action, pending] = useActionState<ToggleBureauActiveState, FormData>(togglePlatformBureauActiveAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="bureauId" value={bureauId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        {active ? "Suspendre ce bureau" : "Réactiver"}
      </button>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function UpdateRateForm({ organizationId, currentRate }: { organizationId: string; currentRate: string }) {
  const [state, action, pending] = useActionState<UpdateBillingRateState, FormData>(updateBillingRateAction, {});
  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div>
        <label htmlFor="billingRatePerBureau" className="block text-xs font-medium text-neutral-600">
          Tarif par bureau (USD/mois)
        </label>
        <input
          id="billingRatePerBureau"
          name="billingRatePerBureau"
          defaultValue={currentRate}
          inputMode="decimal"
          className="mt-1 w-32 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        Mettre à jour
      </button>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function GenerateInvoiceForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState<GenerateInvoiceState, FormData>(generateInvoiceAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div>
        <label htmlFor="periodStart" className="block text-xs font-medium text-neutral-600">
          Début de période
        </label>
        <input
          id="periodStart"
          name="periodStart"
          type="date"
          required
          className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label htmlFor="periodEnd" className="block text-xs font-medium text-neutral-600">
          Fin de période
        </label>
        <input
          id="periodEnd"
          name="periodEnd"
          type="date"
          required
          className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Génération…" : "Générer une facture"}
      </button>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function MarkInvoicePaidButton({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState<MarkInvoicePaidState, FormData>(markInvoicePaidAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        Marquer payée
      </button>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
