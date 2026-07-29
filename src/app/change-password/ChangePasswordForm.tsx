"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Changer le mot de passe</h1>
        {forced ? (
          <p className="mt-1 text-sm text-neutral-500">
            Changement obligatoire avant de continuer.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-neutral-700">
          Mot de passe actuel
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-neutral-700">
          Nouveau mot de passe
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
        />
        <p className="mt-1 text-xs text-neutral-500">Au moins 10 caractères.</p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700">
          Confirmer le nouveau mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-neutral-900 py-2 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
