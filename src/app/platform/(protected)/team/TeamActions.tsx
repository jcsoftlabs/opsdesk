"use client";

import { useActionState } from "react";
import {
  createPlatformAdminAction,
  togglePlatformAdminActiveAction,
  resetPlatformAdminPasswordAction,
  type CreatePlatformAdminState,
  type ToggleAdminActiveState,
  type ResetAdminPasswordState,
} from "./actions";

const createInitialState: CreatePlatformAdminState = {};

export function CreatePlatformAdminForm() {
  const [state, formAction, pending] = useActionState(createPlatformAdminAction, createInitialState);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="font-medium text-neutral-900">Nouveau membre de l&apos;équipe</h2>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="fullName" className="block text-xs font-medium text-neutral-600">
            Nom complet
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-neutral-600">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
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
      {state.temporaryPassword ? (
        <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-800">
          Compte <strong>{state.createdEmail}</strong> créé. Mot de passe temporaire :{" "}
          <code className="font-mono">{state.temporaryPassword}</code> — à communiquer une seule
          fois, changement obligatoire à la première connexion.
        </p>
      ) : null}
    </div>
  );
}

const toggleInitialState: ToggleAdminActiveState = {};
const resetInitialState: ResetAdminPasswordState = {};

export function PlatformAdminRowActions({ platformAdminId, active, isSelf }: { platformAdminId: string; active: boolean; isSelf: boolean }) {
  const [toggleState, toggleAction, togglePending] = useActionState(togglePlatformAdminActiveAction, toggleInitialState);
  const [resetState, resetAction, resetPending] = useActionState(resetPlatformAdminPasswordAction, resetInitialState);

  if (isSelf) {
    return <p className="text-right text-xs text-neutral-400">Votre compte</p>;
  }

  return (
    <div className="space-y-1 text-right">
      <div className="flex justify-end gap-2">
        <form action={toggleAction}>
          <input type="hidden" name="platformAdminId" value={platformAdminId} />
          <button
            type="submit"
            disabled={togglePending}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {active ? "Désactiver" : "Réactiver"}
          </button>
        </form>
        <form action={resetAction}>
          <input type="hidden" name="platformAdminId" value={platformAdminId} />
          <button
            type="submit"
            disabled={resetPending}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Réinitialiser mot de passe
          </button>
        </form>
      </div>
      {toggleState.error ? <p className="text-xs text-red-600">{toggleState.error}</p> : null}
      {resetState.error ? <p className="text-xs text-red-600">{resetState.error}</p> : null}
      {resetState.temporaryPassword ? (
        <p className="rounded bg-amber-50 p-1 text-xs text-amber-800">
          Nouveau mot de passe : <code className="font-mono">{resetState.temporaryPassword}</code>
        </p>
      ) : null}
    </div>
  );
}
